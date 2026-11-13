import type { Page } from '@playwright/test';

// WebGL 2 objects and draw calls of the page, counted per context, for the resource and draw-call
// probes. Not a spec file. `countWebGL` is an init script, so it wraps the context prototype before
// any page code runs: each create/delete of a buffer, texture, program, shader, vertex array,
// framebuffer or renderbuffer adds to or removes from that context's live set, so a double delete
// or delete(null) cannot push a count below the truth; each draw call adds to that context's draw
// counter, which never resets. The page has two contexts: the boot's WebGL 2 check, on a canvas
// outside the page and released unused (RendererHost), and the renderer's, on the page canvas. The
// reader reports the page canvas's context and sums every other one as `elsewhere`.

/** One context's live objects by kind, and its draw calls so far. */
interface Counted {
  live: Record<string, Set<unknown>>;
  draws: number;
}
interface Probe {
  webglProbe?: Map<WebGL2RenderingContext, Counted>;
}

/** Init script: `await page.addInitScript(countWebGL)` before the page loads. */
export function countWebGL(): void {
  const kinds = [
    'Buffer',
    'Texture',
    'Program',
    'Shader',
    'VertexArray',
    'Framebuffer',
    'Renderbuffer',
  ];
  const contexts = new Map<WebGL2RenderingContext, Counted>();
  const of = (gl: WebGL2RenderingContext) => {
    let counted = contexts.get(gl);
    if (!counted) {
      const live = Object.fromEntries(kinds.map((kind) => [kind, new Set<unknown>()]));
      counted = { live, draws: 0 };
      contexts.set(gl, counted);
    }
    return counted;
  };
  const proto = WebGL2RenderingContext.prototype as unknown as Record<
    string,
    (this: WebGL2RenderingContext, ...args: unknown[]) => unknown
  >;
  for (const kind of kinds) {
    const create = proto[`create${kind}`]!;
    const remove = proto[`delete${kind}`]!;
    proto[`create${kind}`] = function (this: WebGL2RenderingContext, ...args: unknown[]) {
      const made = create.apply(this, args);
      if (made) of(this).live[kind]!.add(made);
      return made;
    };
    proto[`delete${kind}`] = function (this: WebGL2RenderingContext, ...args: unknown[]) {
      of(this).live[kind]!.delete(args[0]);
      return remove.apply(this, args);
    };
  }
  for (const name of [
    'drawArrays',
    'drawElements',
    'drawArraysInstanced',
    'drawElementsInstanced',
  ]) {
    const draw = proto[name]!;
    proto[name] = function (this: WebGL2RenderingContext, ...args: unknown[]) {
      of(this).draws++;
      return draw.apply(this, args);
    };
  }
  Object.assign(window, { webglProbe: contexts });
}

/** One reading of the page canvas's context. */
export interface WebGLCounts {
  /** Live objects by kind: the seven kinds countWebGL wraps, in its order. */
  live: Record<string, number>;
  /** Draw calls in one display frame: one game frame, its shadow pass included. */
  draws: number;
  /** Live objects of every other context, summed. */
  elsewhere: number;
  /** The page canvas context's UNMASKED_RENDERER_WEBGL ('?' without WEBGL_debug_renderer_info). */
  renderer: string;
}

/**
 * Reads the page canvas's context over one display frame. The game asks for its next frame at the
 * end of its own callback (main.ts), so each callback here runs just after the game's in the same
 * frame, and the draw counter's difference is exactly one game frame.
 */
export function webglCounts(page: Page): Promise<WebGLCounts> {
  return page.evaluate(() => {
    const contexts =
      (window as unknown as Probe).webglProbe ?? new Map<WebGL2RenderingContext, Counted>();
    const canvas = document.querySelector('.viewport > canvas');
    const own = [...contexts].find(([gl]) => gl.canvas === canvas);
    if (!own) throw new Error('no counted WebGL 2 context on the page canvas: add countWebGL');
    const [gl, counted] = own;
    const debug = gl.getExtension('WEBGL_debug_renderer_info');
    const renderer = debug ? String(gl.getParameter(debug.UNMASKED_RENDERER_WEBGL)) : '?';
    return new Promise<WebGLCounts>((done) => {
      requestAnimationFrame(() => {
        const before = counted.draws;
        requestAnimationFrame(() => {
          let elsewhere = 0;
          for (const [other, { live: sets }] of contexts) {
            if (other !== gl) for (const set of Object.values(sets)) elsewhere += set.size;
          }
          const live = Object.fromEntries(
            Object.entries(counted.live).map(([kind, set]) => [kind, set.size]),
          );
          done({ live, draws: counted.draws - before, elsewhere, renderer });
        });
      });
    });
  });
}
