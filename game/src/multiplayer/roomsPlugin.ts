import type { AddressInfo } from 'node:net';
import { networkInterfaces } from 'node:os';
import type { Connect, Plugin } from 'vite';
import { LanDiscovery } from './lanDiscovery.ts';
import { roomRoutes } from './roomHttp.ts';
import { RoomHub } from './RoomHub.ts';

/** What the dev server and the preview server both have. */
interface Served {
  readonly middlewares: Connect.Server;
  readonly httpServer: {
    once(event: 'listening' | 'close', listener: () => void): unknown;
    address(): AddressInfo | string | null;
  } | null;
  readonly config: {
    readonly logger: { info(message: string): void; warn(message: string): void };
  };
}

/**
 * The LAN room server (Phase M) on the Vite servers: the dev server (`npm run dev:lan`) and the
 * preview of a build (`npm run preview:lan`; the desktop app's server), at `/simlab-rooms` on the
 * game's own port (`roomHttp.ts`: plain HTTP, no other server, port or dependency). A packaged
 * app's own server can mount the same routes. Each server also finds the others on the LAN
 * (`lanDiscovery.ts`, UDP): it always listens, and announces itself when shared (--host).
 */
export function roomsPlugin(): Plugin {
  const mount = (server: Served, host: string | boolean | undefined) => {
    const hub = new RoomHub();
    let lan: LanDiscovery | null = null;
    const routes = roomRoutes(hub, () => lan?.servers() ?? []);
    server.middlewares.use((req, res, next) => {
      if (!routes(req, res)) next();
    });
    server.httpServer?.once('listening', () => {
      const address = server.httpServer?.address();
      const port = typeof address === 'object' && address ? address.port : 0;
      const shared = host === true || host === '0.0.0.0' || host === '::';
      lan = new LanDiscovery({
        port,
        announce: shared,
        rooms: () => hub.list(),
        log: (message) => server.config.logger.warn(`  SimLab rooms: ${message}`),
      });
      void lan.start();
      server.httpServer?.once('close', () => lan?.stop());
      const ips = shared ? lanAddresses() : [];
      const where = ips.length
        ? `${ips.map((ip) => `http://${ip}:${port}/`).join('  ')}; announced on the LAN`
        : 'this computer only, not announced on the LAN (add --host, as npm run dev:lan does, to share it)';
      server.config.logger.info(`  SimLab rooms: ready — other players open ${where}`);
    });
  };
  return {
    name: 'simlab:rooms',
    apply: 'serve',
    configureServer(server) {
      mount(server, server.config.server.host);
    },
    configurePreviewServer(server) {
      mount(server, server.config.preview.host);
    },
  };
}

/** This computer's IPv4 addresses on its networks (not the loopback). */
function lanAddresses(): string[] {
  const found: string[] = [];
  for (const list of Object.values(networkInterfaces())) {
    for (const net of list ?? []) {
      if (net.family === 'IPv4' && !net.internal) found.push(net.address);
    }
  }
  return found;
}
