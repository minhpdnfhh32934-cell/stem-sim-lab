import{A as e,E as t,Ft as n,Gr as r,Ht as i,Ir as a,Jt as o,K as s,Kr as c,Lr as l,X as u,Xr as d,_n as f,g as p,hr as m,ir as h,j as g,mr as _,zr as v}from"./three.core-DK1JzqWC.js";import{a as y,i as b,r as x,s as S}from"./WorldRenderer-DPzeKjYd.js";import{n as C,t as w}from"./postLook-gh67m1N7.js";import{a as T,c as E,i as D,l as O,n as ee,o as k,r as A,s as j,t as M}from"./UnrealBloomPass-CwU4um_Q.js";var N={name:`GTAOShader`,defines:{PERSPECTIVE_CAMERA:1,SAMPLES:16,NORMAL_VECTOR_TYPE:1,DEPTH_SWIZZLING:`x`,SCREEN_SPACE_RADIUS:0,SCREEN_SPACE_RADIUS_SCALE:100,SCENE_CLIP_BOX:0},uniforms:{tNormal:{value:null},tDepth:{value:null},tNoise:{value:null},resolution:{value:new r},cameraNear:{value:null},cameraFar:{value:null},cameraProjectionMatrix:{value:new n},cameraProjectionMatrixInverse:{value:new n},cameraWorldMatrix:{value:new n},radius:{value:.25},distanceExponent:{value:1},thickness:{value:1},distanceFallOff:{value:1},scale:{value:1},sceneBoxMin:{value:new c(-1,-1,-1)},sceneBoxMax:{value:new c(1,1,1)}},vertexShader:`

		varying vec2 vUv;

		void main() {
			vUv = uv;
			gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
		}`,fragmentShader:`
		varying vec2 vUv;
		uniform highp sampler2D tNormal;
		uniform highp sampler2D tDepth;
		uniform sampler2D tNoise;
		uniform vec2 resolution;
		uniform float cameraNear;
		uniform float cameraFar;
		uniform mat4 cameraProjectionMatrix;
		uniform mat4 cameraProjectionMatrixInverse;
		uniform mat4 cameraWorldMatrix;
		uniform float radius;
		uniform float distanceExponent;
		uniform float thickness;
		uniform float distanceFallOff;
		uniform float scale;
		#if SCENE_CLIP_BOX == 1
			uniform vec3 sceneBoxMin;
			uniform vec3 sceneBoxMax;
		#endif

		#include <common>
		#include <packing>

		#ifndef FRAGMENT_OUTPUT
		#define FRAGMENT_OUTPUT vec4(vec3(ao), 1.)
		#endif

		vec3 getViewPosition( const in vec2 screenPosition, const in float depth ) {
			#ifdef USE_REVERSED_DEPTH_BUFFER
				vec4 clipSpacePosition = vec4( vec2( screenPosition ) * 2.0 - 1.0, depth, 1.0 );
			#else
				vec4 clipSpacePosition = vec4( vec3( screenPosition, depth ) * 2.0 - 1.0, 1.0 );
			#endif
			vec4 viewSpacePosition = cameraProjectionMatrixInverse * clipSpacePosition;
			return viewSpacePosition.xyz / viewSpacePosition.w;
		}

		float getDepth(const vec2 uv) {
			return textureLod(tDepth, uv.xy, 0.0).DEPTH_SWIZZLING;
		}

		float fetchDepth(const ivec2 uv) {
			return texelFetch(tDepth, uv.xy, 0).DEPTH_SWIZZLING;
		}

		float getViewZ(const in float depth) {
			#if PERSPECTIVE_CAMERA == 1
				return perspectiveDepthToViewZ(depth, cameraNear, cameraFar);
			#else
				return orthographicDepthToViewZ(depth, cameraNear, cameraFar);
			#endif
		}

		vec3 computeNormalFromDepth(const vec2 uv) {
			vec2 size = vec2(textureSize(tDepth, 0));
			ivec2 p = ivec2(uv * size);
			float c0 = fetchDepth(p);
			float l2 = fetchDepth(p - ivec2(2, 0));
			float l1 = fetchDepth(p - ivec2(1, 0));
			float r1 = fetchDepth(p + ivec2(1, 0));
			float r2 = fetchDepth(p + ivec2(2, 0));
			float b2 = fetchDepth(p - ivec2(0, 2));
			float b1 = fetchDepth(p - ivec2(0, 1));
			float t1 = fetchDepth(p + ivec2(0, 1));
			float t2 = fetchDepth(p + ivec2(0, 2));
			float dl = abs((2.0 * l1 - l2) - c0);
			float dr = abs((2.0 * r1 - r2) - c0);
			float db = abs((2.0 * b1 - b2) - c0);
			float dt = abs((2.0 * t1 - t2) - c0);
			vec3 ce = getViewPosition(uv, c0).xyz;
			vec3 dpdx = (dl < dr) ? ce - getViewPosition((uv - vec2(1.0 / size.x, 0.0)), l1).xyz : -ce + getViewPosition((uv + vec2(1.0 / size.x, 0.0)), r1).xyz;
			vec3 dpdy = (db < dt) ? ce - getViewPosition((uv - vec2(0.0, 1.0 / size.y)), b1).xyz : -ce + getViewPosition((uv + vec2(0.0, 1.0 / size.y)), t1).xyz;
			return normalize(cross(dpdx, dpdy));
		}

		vec3 getViewNormal(const vec2 uv) {
			#if NORMAL_VECTOR_TYPE == 2
				return normalize(textureLod(tNormal, uv, 0.).rgb);
			#elif NORMAL_VECTOR_TYPE == 1
				return unpackRGBToNormal(textureLod(tNormal, uv, 0.).rgb);
			#else
				return computeNormalFromDepth(uv);
			#endif
		}

		vec3 getSceneUvAndDepth(vec3 sampleViewPos) {
			vec4 sampleClipPos = cameraProjectionMatrix * vec4(sampleViewPos, 1.);
			vec2 sampleUv = sampleClipPos.xy / sampleClipPos.w * 0.5 + 0.5;
			float sampleSceneDepth = getDepth(sampleUv);
			return vec3(sampleUv, sampleSceneDepth);
		}

		void main() {
			float depth = getDepth(vUv.xy);

			#ifdef USE_REVERSED_DEPTH_BUFFER
				if (depth <= 0.0) {
					discard;
					return;
				}
			#else
				if (depth >= 1.0) {
					discard;
					return;
				}
			#endif
			
			vec3 viewPos = getViewPosition(vUv, depth);
			vec3 viewNormal = getViewNormal(vUv);

			float radiusToUse = radius;
			float distanceFalloffToUse = thickness;
			#if SCREEN_SPACE_RADIUS == 1
				float radiusScale = getViewPosition(vec2(0.5 + float(SCREEN_SPACE_RADIUS_SCALE) / resolution.x, 0.0), depth).x;
				radiusToUse *= radiusScale;
				distanceFalloffToUse *= radiusScale;
			#endif

			#if SCENE_CLIP_BOX == 1
				vec3 worldPos = (cameraWorldMatrix * vec4(viewPos, 1.0)).xyz;
				float boxDistance = length(max(vec3(0.0), max(sceneBoxMin - worldPos, worldPos - sceneBoxMax)));
				if (boxDistance > radiusToUse) {
					discard;
					return;
				}
			#endif

			vec2 noiseResolution = vec2(textureSize(tNoise, 0));
			vec2 noiseUv = vUv * resolution / noiseResolution;
			vec4 noiseTexel = textureLod(tNoise, noiseUv, 0.0);
			vec3 randomVec = noiseTexel.xyz * 2.0 - 1.0;
			vec3 tangent = normalize(vec3(randomVec.xy, 0.));
			vec3 bitangent = vec3(-tangent.y, tangent.x, 0.);
			mat3 kernelMatrix = mat3(tangent, bitangent, vec3(0., 0., 1.));

			const int DIRECTIONS = SAMPLES < 30 ? 3 : 5;
			const int STEPS = (SAMPLES + DIRECTIONS - 1) / DIRECTIONS;
			float ao = 0.0;
			for (int i = 0; i < DIRECTIONS; ++i) {

				float angle = float(i) / float(DIRECTIONS) * PI;
				vec4 sampleDir = vec4(cos(angle), sin(angle), 0., 0.5 + 0.5 * noiseTexel.w);
				sampleDir.xyz = normalize(kernelMatrix * sampleDir.xyz);

				vec3 viewDir = normalize(-viewPos.xyz);
				vec3 sliceBitangent = normalize(cross(sampleDir.xyz, viewDir));
				vec3 sliceTangent = cross(sliceBitangent, viewDir);
				vec3 normalInSlice = normalize(viewNormal - sliceBitangent * dot(viewNormal, sliceBitangent));

				vec3 tangentToNormalInSlice = cross(normalInSlice, sliceBitangent);
				vec2 cosHorizons = vec2(dot(viewDir, tangentToNormalInSlice), dot(viewDir, -tangentToNormalInSlice));

				for (int j = 0; j < STEPS; ++j) {
					vec3 sampleViewOffset = sampleDir.xyz * radiusToUse * sampleDir.w * pow(float(j + 1) / float(STEPS), distanceExponent);

					vec3 sampleSceneUvDepth = getSceneUvAndDepth(viewPos + sampleViewOffset);
					vec3 sampleSceneViewPos = getViewPosition(sampleSceneUvDepth.xy, sampleSceneUvDepth.z);
					vec3 viewDelta = sampleSceneViewPos - viewPos;
					if (abs(viewDelta.z) < thickness) {
						float sampleCosHorizon = dot(viewDir, normalize(viewDelta));
						cosHorizons.x += max(0., (sampleCosHorizon - cosHorizons.x) * mix(1., 2. / float(j + 2), distanceFallOff));
					}

					sampleSceneUvDepth = getSceneUvAndDepth(viewPos - sampleViewOffset);
					sampleSceneViewPos = getViewPosition(sampleSceneUvDepth.xy, sampleSceneUvDepth.z);
					viewDelta = sampleSceneViewPos - viewPos;
					if (abs(viewDelta.z) < thickness) {
						float sampleCosHorizon = dot(viewDir, normalize(viewDelta));
						cosHorizons.y += max(0., (sampleCosHorizon - cosHorizons.y) * mix(1., 2. / float(j + 2), distanceFallOff));
					}
				}

				vec2 sinHorizons = sqrt(1. - cosHorizons * cosHorizons);
				float nx = dot(normalInSlice, sliceTangent);
				float ny = dot(normalInSlice, viewDir);
				float nxb = 1. / 2. * (acos(cosHorizons.y) - acos(cosHorizons.x) + sinHorizons.x * cosHorizons.x - sinHorizons.y * cosHorizons.y);
				float nyb = 1. / 2. * (2. - cosHorizons.x * cosHorizons.x - cosHorizons.y * cosHorizons.y);
				float occlusion = nx * nxb + ny * nyb;
				ao += occlusion;
			}

			ao = clamp(ao / float(DIRECTIONS), 0., 1.);
		#if SCENE_CLIP_BOX == 1
			ao = mix(ao, 1., smoothstep(0., radiusToUse, boxDistance));
		#endif
			ao = pow(ao, scale);

			gl_FragColor = FRAGMENT_OUTPUT;
		}`},P={name:`GTAODepthShader`,defines:{PERSPECTIVE_CAMERA:1},uniforms:{tDepth:{value:null},cameraNear:{value:null},cameraFar:{value:null}},vertexShader:`
		varying vec2 vUv;

		void main() {
			vUv = uv;
			gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
		}`,fragmentShader:`
		uniform sampler2D tDepth;
		uniform float cameraNear;
		uniform float cameraFar;
		varying vec2 vUv;

		#include <packing>

		float getLinearDepth( const in vec2 screenPosition ) {
			#if PERSPECTIVE_CAMERA == 1
				float fragCoordZ = texture2D( tDepth, screenPosition ).x;
				float viewZ = perspectiveDepthToViewZ( fragCoordZ, cameraNear, cameraFar );
				return viewZToOrthographicDepth( viewZ, cameraNear, cameraFar );
			#else
				return texture2D( tDepth, screenPosition ).x;
			#endif
		}

		void main() {
			float depth = getLinearDepth( vUv );
			gl_FragColor = vec4( vec3( 1.0 - depth ), 1.0 );

		}`},F={name:`GTAOBlendShader`,uniforms:{tDiffuse:{value:null},intensity:{value:1}},vertexShader:`
		varying vec2 vUv;

		void main() {
			vUv = uv;
			gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
		}`,fragmentShader:`
		uniform float intensity;
		uniform sampler2D tDiffuse;
		varying vec2 vUv;

		void main() {
			vec4 texel = texture2D( tDiffuse, vUv );
			gl_FragColor = vec4(mix(vec3(1.), texel.rgb, intensity), texel.a);
		}`};function te(e=5){let n=Math.floor(e)%2==0?Math.floor(e)+1:Math.floor(e),r=ne(n),i=r.length,a=new Uint8Array(i*4);for(let e=0;e<i;++e){let t=r[e],n=2*Math.PI*t/i,o=new c(Math.cos(n),Math.sin(n),0).normalize();a[e*4]=(o.x*.5+.5)*255,a[e*4+1]=(o.y*.5+.5)*255,a[e*4+2]=127,a[e*4+3]=255}let o=new t(a,n,n);return o.wrapS=h,o.wrapT=h,o.needsUpdate=!0,o}function ne(e){let t=Math.floor(e)%2==0?Math.floor(e)+1:Math.floor(e),n=t*t,r=Array(n).fill(0),i=Math.floor(t/2),a=t-1;for(let e=1;e<=n;)i===-1&&a===t?(a=t-2,i=0):(a===t&&(a=0),i<0&&(i=t-1)),r[i*t+a]===0?(r[i*t+a]=e++,a++,i--):(a-=2,i++);return r}var I={name:`PoissonDenoiseShader`,defines:{SAMPLES:16,SAMPLE_VECTORS:L(16,2,1),NORMAL_VECTOR_TYPE:1,DEPTH_VALUE_SOURCE:0},uniforms:{tDiffuse:{value:null},tNormal:{value:null},tDepth:{value:null},tNoise:{value:null},resolution:{value:new r},cameraProjectionMatrixInverse:{value:new n},lumaPhi:{value:5},depthPhi:{value:5},normalPhi:{value:5},radius:{value:4},index:{value:0}},vertexShader:`

		varying vec2 vUv;

		void main() {
			vUv = uv;
			gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
		}`,fragmentShader:`

		varying vec2 vUv;

		uniform sampler2D tDiffuse;
		uniform sampler2D tNormal;
		uniform sampler2D tDepth;
		uniform sampler2D tNoise;
		uniform vec2 resolution;
		uniform mat4 cameraProjectionMatrixInverse;
		uniform float lumaPhi;
		uniform float depthPhi;
		uniform float normalPhi;
		uniform float radius;
		uniform int index;

		#include <common>
		#include <packing>

		#ifndef SAMPLE_LUMINANCE
		#define SAMPLE_LUMINANCE dot(vec3(0.2125, 0.7154, 0.0721), a)
		#endif

		#ifndef FRAGMENT_OUTPUT
		#define FRAGMENT_OUTPUT vec4(denoised, 1.)
		#endif

		float getLuminance(const in vec3 a) {
			return SAMPLE_LUMINANCE;
		}

		const vec3 poissonDisk[SAMPLES] = SAMPLE_VECTORS;

		vec3 getViewPosition( const in vec2 screenPosition, const in float depth ) {
			#ifdef USE_REVERSED_DEPTH_BUFFER
				vec4 clipSpacePosition = vec4( vec2( screenPosition ) * 2.0 - 1.0, depth, 1.0 );
			#else
				vec4 clipSpacePosition = vec4( vec3( screenPosition, depth ) * 2.0 - 1.0, 1.0 );
			#endif
			vec4 viewSpacePosition = cameraProjectionMatrixInverse * clipSpacePosition;
			return viewSpacePosition.xyz / viewSpacePosition.w;
		}

		float getDepth(const vec2 uv) {
		#if DEPTH_VALUE_SOURCE == 1
			return textureLod(tDepth, uv.xy, 0.0).a;
		#else
			return textureLod(tDepth, uv.xy, 0.0).r;
		#endif
		}

		float fetchDepth(const ivec2 uv) {
			#if DEPTH_VALUE_SOURCE == 1
				return texelFetch(tDepth, uv.xy, 0).a;
			#else
				return texelFetch(tDepth, uv.xy, 0).r;
			#endif
		}

		vec3 computeNormalFromDepth(const vec2 uv) {
			vec2 size = vec2(textureSize(tDepth, 0));
			ivec2 p = ivec2(uv * size);
			float c0 = fetchDepth(p);
			float l2 = fetchDepth(p - ivec2(2, 0));
			float l1 = fetchDepth(p - ivec2(1, 0));
			float r1 = fetchDepth(p + ivec2(1, 0));
			float r2 = fetchDepth(p + ivec2(2, 0));
			float b2 = fetchDepth(p - ivec2(0, 2));
			float b1 = fetchDepth(p - ivec2(0, 1));
			float t1 = fetchDepth(p + ivec2(0, 1));
			float t2 = fetchDepth(p + ivec2(0, 2));
			float dl = abs((2.0 * l1 - l2) - c0);
			float dr = abs((2.0 * r1 - r2) - c0);
			float db = abs((2.0 * b1 - b2) - c0);
			float dt = abs((2.0 * t1 - t2) - c0);
			vec3 ce = getViewPosition(uv, c0).xyz;
			vec3 dpdx = (dl < dr) ?  ce - getViewPosition((uv - vec2(1.0 / size.x, 0.0)), l1).xyz
									: -ce + getViewPosition((uv + vec2(1.0 / size.x, 0.0)), r1).xyz;
			vec3 dpdy = (db < dt) ?  ce - getViewPosition((uv - vec2(0.0, 1.0 / size.y)), b1).xyz
									: -ce + getViewPosition((uv + vec2(0.0, 1.0 / size.y)), t1).xyz;
			return normalize(cross(dpdx, dpdy));
		}

		vec3 getViewNormal(const vec2 uv) {
		#if NORMAL_VECTOR_TYPE == 2
			return normalize(textureLod(tNormal, uv, 0.).rgb);
		#elif NORMAL_VECTOR_TYPE == 1
			return unpackRGBToNormal(textureLod(tNormal, uv, 0.).rgb);
		#else
			return computeNormalFromDepth(uv);
		#endif
		}

		void denoiseSample(in vec3 center, in vec3 viewNormal, in vec3 viewPos, in vec2 sampleUv, inout vec3 denoised, inout float totalWeight) {
			vec4 sampleTexel = textureLod(tDiffuse, sampleUv, 0.0);
			float sampleDepth = getDepth(sampleUv);
			vec3 sampleNormal = getViewNormal(sampleUv);
			vec3 neighborColor = sampleTexel.rgb;
			vec3 viewPosSample = getViewPosition(sampleUv, sampleDepth);

			float normalDiff = dot(viewNormal, sampleNormal);
			float normalSimilarity = pow(max(normalDiff, 0.), normalPhi);
			float lumaDiff = abs(getLuminance(neighborColor) - getLuminance(center));
			float lumaSimilarity = max(1.0 - lumaDiff / lumaPhi, 0.0);
			float depthDiff = abs(dot(viewPos - viewPosSample, viewNormal));
			float depthSimilarity = max(1. - depthDiff / depthPhi, 0.);
			float w = lumaSimilarity * depthSimilarity * normalSimilarity;

			denoised += w * neighborColor;
			totalWeight += w;
		}

		void main() {
			float depth = getDepth(vUv.xy);
			vec3 viewNormal = getViewNormal(vUv);
			if (depth == 1. || dot(viewNormal, viewNormal) == 0.) {
				discard;
				return;
			}
			vec4 texel = textureLod(tDiffuse, vUv, 0.0);
			vec3 center = texel.rgb;
			vec3 viewPos = getViewPosition(vUv, depth);

			vec2 noiseResolution = vec2(textureSize(tNoise, 0));
			vec2 noiseUv = vUv * resolution / noiseResolution;
			vec4 noiseTexel = textureLod(tNoise, noiseUv, 0.0);
      		vec2 noiseVec = vec2(sin(noiseTexel[index % 4] * 2. * PI), cos(noiseTexel[index % 4] * 2. * PI));
    		mat2 rotationMatrix = mat2(noiseVec.x, -noiseVec.y, noiseVec.x, noiseVec.y);

			float totalWeight = 1.0;
			vec3 denoised = texel.rgb;
			for (int i = 0; i < SAMPLES; i++) {
				vec3 sampleDir = poissonDisk[i];
				vec2 offset = rotationMatrix * (sampleDir.xy * (1. + sampleDir.z * (radius - 1.)) / resolution);
				vec2 sampleUv = vUv + offset;
				denoiseSample(center, viewNormal, viewPos, sampleUv, denoised, totalWeight);
			}

			if (totalWeight > 0.) {
				denoised /= totalWeight;
			}
			gl_FragColor = FRAGMENT_OUTPUT;
		}`};function L(e,t,n){let r=R(e,t,n),i=`vec3[SAMPLES](`;for(let t=0;t<e;t++){let n=r[t];i+=`vec3(${n.x}, ${n.y}, ${n.z})${t<e-1?`,`:`)`}`}return i}function R(e,t,n){let r=[];for(let i=0;i<e;i++){let a=2*Math.PI*t*i/e,o=(i/(e-1))**n;r.push(new c(Math.cos(a),Math.sin(a),o))}return r}var z=class{constructor(e=Math){this.grad3=[[1,1,0],[-1,1,0],[1,-1,0],[-1,-1,0],[1,0,1],[-1,0,1],[1,0,-1],[-1,0,-1],[0,1,1],[0,-1,1],[0,1,-1],[0,-1,-1]],this.grad4=[[0,1,1,1],[0,1,1,-1],[0,1,-1,1],[0,1,-1,-1],[0,-1,1,1],[0,-1,1,-1],[0,-1,-1,1],[0,-1,-1,-1],[1,0,1,1],[1,0,1,-1],[1,0,-1,1],[1,0,-1,-1],[-1,0,1,1],[-1,0,1,-1],[-1,0,-1,1],[-1,0,-1,-1],[1,1,0,1],[1,1,0,-1],[1,-1,0,1],[1,-1,0,-1],[-1,1,0,1],[-1,1,0,-1],[-1,-1,0,1],[-1,-1,0,-1],[1,1,1,0],[1,1,-1,0],[1,-1,1,0],[1,-1,-1,0],[-1,1,1,0],[-1,1,-1,0],[-1,-1,1,0],[-1,-1,-1,0]],this.p=[];for(let t=0;t<256;t++)this.p[t]=Math.floor(e.random()*256);this.perm=[];for(let e=0;e<512;e++)this.perm[e]=this.p[e&255];this.simplex=[[0,1,2,3],[0,1,3,2],[0,0,0,0],[0,2,3,1],[0,0,0,0],[0,0,0,0],[0,0,0,0],[1,2,3,0],[0,2,1,3],[0,0,0,0],[0,3,1,2],[0,3,2,1],[0,0,0,0],[0,0,0,0],[0,0,0,0],[1,3,2,0],[0,0,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0],[1,2,0,3],[0,0,0,0],[1,3,0,2],[0,0,0,0],[0,0,0,0],[0,0,0,0],[2,3,0,1],[2,3,1,0],[1,0,2,3],[1,0,3,2],[0,0,0,0],[0,0,0,0],[0,0,0,0],[2,0,3,1],[0,0,0,0],[2,1,3,0],[0,0,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0],[2,0,1,3],[0,0,0,0],[0,0,0,0],[0,0,0,0],[3,0,1,2],[3,0,2,1],[0,0,0,0],[3,1,2,0],[2,1,0,3],[0,0,0,0],[0,0,0,0],[0,0,0,0],[3,1,0,2],[0,0,0,0],[3,2,0,1],[3,2,1,0]]}noise(e,t){let n,r,i,a=.5*(Math.sqrt(3)-1),o=(e+t)*a,s=Math.floor(e+o),c=Math.floor(t+o),l=(3-Math.sqrt(3))/6,u=(s+c)*l,d=s-u,f=c-u,p=e-d,m=t-f,h,g;p>m?(h=1,g=0):(h=0,g=1);let _=p-h+l,v=m-g+l,y=p-1+2*l,b=m-1+2*l,x=s&255,S=c&255,C=this.perm[x+this.perm[S]]%12,w=this.perm[x+h+this.perm[S+g]]%12,T=this.perm[x+1+this.perm[S+1]]%12,E=.5-p*p-m*m;E<0?n=0:(E*=E,n=E*E*this._dot(this.grad3[C],p,m));let D=.5-_*_-v*v;D<0?r=0:(D*=D,r=D*D*this._dot(this.grad3[w],_,v));let O=.5-y*y-b*b;return O<0?i=0:(O*=O,i=O*O*this._dot(this.grad3[T],y,b)),70*(n+r+i)}noise3d(e,t,n){let r,i,a,o,s=(e+t+n)*(1/3),c=Math.floor(e+s),l=Math.floor(t+s),u=Math.floor(n+s),d=1/6,f=(c+l+u)*d,p=c-f,m=l-f,h=u-f,g=e-p,_=t-m,v=n-h,y,b,x,S,C,w;g>=_?_>=v?(y=1,b=0,x=0,S=1,C=1,w=0):g>=v?(y=1,b=0,x=0,S=1,C=0,w=1):(y=0,b=0,x=1,S=1,C=0,w=1):_<v?(y=0,b=0,x=1,S=0,C=1,w=1):g<v?(y=0,b=1,x=0,S=0,C=1,w=1):(y=0,b=1,x=0,S=1,C=1,w=0);let T=g-y+d,E=_-b+d,D=v-x+d,O=g-S+2*d,ee=_-C+2*d,k=v-w+2*d,A=g-1+3*d,j=_-1+3*d,M=v-1+3*d,N=c&255,P=l&255,F=u&255,te=this.perm[N+this.perm[P+this.perm[F]]]%12,ne=this.perm[N+y+this.perm[P+b+this.perm[F+x]]]%12,I=this.perm[N+S+this.perm[P+C+this.perm[F+w]]]%12,L=this.perm[N+1+this.perm[P+1+this.perm[F+1]]]%12,R=.6-g*g-_*_-v*v;R<0?r=0:(R*=R,r=R*R*this._dot3(this.grad3[te],g,_,v));let z=.6-T*T-E*E-D*D;z<0?i=0:(z*=z,i=z*z*this._dot3(this.grad3[ne],T,E,D));let B=.6-O*O-ee*ee-k*k;B<0?a=0:(B*=B,a=B*B*this._dot3(this.grad3[I],O,ee,k));let V=.6-A*A-j*j-M*M;return V<0?o=0:(V*=V,o=V*V*this._dot3(this.grad3[L],A,j,M)),32*(r+i+a+o)}noise4d(e,t,n,r){let i=this.grad4,a=this.simplex,o=this.perm,s=(Math.sqrt(5)-1)/4,c=(5-Math.sqrt(5))/20,l,u,d,f,p,m=(e+t+n+r)*s,h=Math.floor(e+m),g=Math.floor(t+m),_=Math.floor(n+m),v=Math.floor(r+m),y=(h+g+_+v)*c,b=h-y,x=g-y,S=_-y,C=v-y,w=e-b,T=t-x,E=n-S,D=r-C,O=w>T?32:0,ee=w>E?16:0,k=T>E?8:0,A=w>D?4:0,j=T>D?2:0,M=+(E>D),N=O+ee+k+A+j+M,P=+(a[N][0]>=3),F=+(a[N][1]>=3),te=+(a[N][2]>=3),ne=+(a[N][3]>=3),I=+(a[N][0]>=2),L=+(a[N][1]>=2),R=+(a[N][2]>=2),z=+(a[N][3]>=2),B=+(a[N][0]>=1),V=+(a[N][1]>=1),re=+(a[N][2]>=1),ie=+(a[N][3]>=1),ae=w-P+c,oe=T-F+c,se=E-te+c,ce=D-ne+c,le=w-I+2*c,ue=T-L+2*c,H=E-R+2*c,U=D-z+2*c,de=w-B+3*c,W=T-V+3*c,fe=E-re+3*c,pe=D-ie+3*c,G=w-1+4*c,me=T-1+4*c,he=E-1+4*c,ge=D-1+4*c,K=h&255,q=g&255,J=_&255,Y=v&255,_e=o[K+o[q+o[J+o[Y]]]]%32,ve=o[K+P+o[q+F+o[J+te+o[Y+ne]]]]%32,ye=o[K+I+o[q+L+o[J+R+o[Y+z]]]]%32,be=o[K+B+o[q+V+o[J+re+o[Y+ie]]]]%32,xe=o[K+1+o[q+1+o[J+1+o[Y+1]]]]%32,X=.6-w*w-T*T-E*E-D*D;X<0?l=0:(X*=X,l=X*X*this._dot4(i[_e],w,T,E,D));let Z=.6-ae*ae-oe*oe-se*se-ce*ce;Z<0?u=0:(Z*=Z,u=Z*Z*this._dot4(i[ve],ae,oe,se,ce));let Q=.6-le*le-ue*ue-H*H-U*U;Q<0?d=0:(Q*=Q,d=Q*Q*this._dot4(i[ye],le,ue,H,U));let Se=.6-de*de-W*W-fe*fe-pe*pe;Se<0?f=0:(Se*=Se,f=Se*Se*this._dot4(i[be],de,W,fe,pe));let $=.6-G*G-me*me-he*he-ge*ge;return $<0?p=0:($*=$,p=$*$*this._dot4(i[xe],G,me,he,ge)),27*(l+u+d+f+p)}_dot(e,t,n){return e[0]*t+e[1]*n}_dot3(e,t,n,r){return e[0]*t+e[1]*n+e[2]*r}_dot4(e,t,n,r,i){return e[0]*t+e[1]*n+e[2]*r+e[3]*i}},B=class n extends E{constructor(e,t,n=512,r=512,o,s,c){super(),this.width=n,this.height=r,this.clear=!0,this.camera=t,this.scene=e,this.output=0,this._renderGBuffer=!0,this._visibilityCache=[],this.blendIntensity=1,this.pdRings=2,this.pdRadiusExponent=2,this.pdSamples=16,this.gtaoNoiseTexture=te(),this.pdNoiseTexture=this._generateNoise(),this.gtaoRenderTarget=new d(this.width,this.height,{type:u,depthBuffer:!1}),this.pdRenderTarget=this.gtaoRenderTarget.clone(),this.gtaoMaterial=new m({defines:Object.assign({},N.defines),uniforms:a.clone(N.uniforms),vertexShader:N.vertexShader,fragmentShader:N.fragmentShader,blending:0,depthTest:!1,depthWrite:!1}),this.gtaoMaterial.defines.PERSPECTIVE_CAMERA=+!!this.camera.isPerspectiveCamera,this.gtaoMaterial.uniforms.tNoise.value=this.gtaoNoiseTexture,this.gtaoMaterial.uniforms.resolution.value.set(this.width,this.height),this.gtaoMaterial.uniforms.cameraNear.value=this.camera.near,this.gtaoMaterial.uniforms.cameraFar.value=this.camera.far,this.normalMaterial=new i,this.normalMaterial.blending=0,this.pdMaterial=new m({defines:Object.assign({},I.defines),uniforms:a.clone(I.uniforms),vertexShader:I.vertexShader,fragmentShader:I.fragmentShader,depthTest:!1,depthWrite:!1}),this.pdMaterial.uniforms.tDiffuse.value=this.gtaoRenderTarget.texture,this.pdMaterial.uniforms.tNoise.value=this.pdNoiseTexture,this.pdMaterial.uniforms.resolution.value.set(this.width,this.height),this.pdMaterial.uniforms.lumaPhi.value=10,this.pdMaterial.uniforms.depthPhi.value=2,this.pdMaterial.uniforms.normalPhi.value=3,this.pdMaterial.uniforms.radius.value=8,this.depthRenderMaterial=new m({defines:Object.assign({},P.defines),uniforms:a.clone(P.uniforms),vertexShader:P.vertexShader,fragmentShader:P.fragmentShader,blending:0}),this.depthRenderMaterial.uniforms.cameraNear.value=this.camera.near,this.depthRenderMaterial.uniforms.cameraFar.value=this.camera.far,this.copyMaterial=new m({uniforms:a.clone(O.uniforms),vertexShader:O.vertexShader,fragmentShader:O.fragmentShader,transparent:!0,depthTest:!1,depthWrite:!1,blendSrc:208,blendDst:200,blendEquation:100,blendSrcAlpha:206,blendDstAlpha:200,blendEquationAlpha:100}),this.blendMaterial=new m({uniforms:a.clone(F.uniforms),vertexShader:F.vertexShader,fragmentShader:F.fragmentShader,transparent:!0,depthTest:!1,depthWrite:!1,blending:5,blendSrc:208,blendDst:200,blendEquation:100,blendSrcAlpha:206,blendDstAlpha:200,blendEquationAlpha:100}),this._fsQuad=new j(null),this._originalClearColor=new p,this.setGBuffer(o?o.depthTexture:void 0,o?o.normalTexture:void 0),s!==void 0&&this.updateGtaoMaterial(s),c!==void 0&&this.updatePdMaterial(c)}setSize(e,t){this.width=e,this.height=t,this.gtaoRenderTarget.setSize(e,t),this.normalRenderTarget.setSize(e,t),this.pdRenderTarget.setSize(e,t),this.gtaoMaterial.uniforms.resolution.value.set(e,t),this.gtaoMaterial.uniforms.cameraProjectionMatrix.value.copy(this.camera.projectionMatrix),this.gtaoMaterial.uniforms.cameraProjectionMatrixInverse.value.copy(this.camera.projectionMatrixInverse),this.pdMaterial.uniforms.resolution.value.set(e,t),this.pdMaterial.uniforms.cameraProjectionMatrixInverse.value.copy(this.camera.projectionMatrixInverse)}dispose(){this.gtaoNoiseTexture.dispose(),this.pdNoiseTexture.dispose(),this.normalRenderTarget.dispose(),this.gtaoRenderTarget.dispose(),this.pdRenderTarget.dispose(),this.normalMaterial.dispose(),this.pdMaterial.dispose(),this.copyMaterial.dispose(),this.depthRenderMaterial.dispose(),this._fsQuad.dispose()}get gtaoMap(){return this.pdRenderTarget.texture}setGBuffer(t,n){t===void 0?(this.depthTexture=new g,this.depthTexture.format=e,this.depthTexture.type=v,this.normalRenderTarget=new d(this.width,this.height,{minFilter:o,magFilter:o,type:u,depthTexture:this.depthTexture}),this.normalTexture=this.normalRenderTarget.texture,this._renderGBuffer=!0):(this.depthTexture=t,this.normalTexture=n,this._renderGBuffer=!1);let r=+!!this.normalTexture,i=this.depthTexture===this.normalTexture?`w`:`x`;this.gtaoMaterial.defines.NORMAL_VECTOR_TYPE=r,this.gtaoMaterial.defines.DEPTH_SWIZZLING=i,this.gtaoMaterial.uniforms.tNormal.value=this.normalTexture,this.gtaoMaterial.uniforms.tDepth.value=this.depthTexture,this.pdMaterial.defines.NORMAL_VECTOR_TYPE=r,this.pdMaterial.defines.DEPTH_SWIZZLING=i,this.pdMaterial.uniforms.tNormal.value=this.normalTexture,this.pdMaterial.uniforms.tDepth.value=this.depthTexture,this.depthRenderMaterial.uniforms.tDepth.value=this.normalRenderTarget.depthTexture}setSceneClipBox(e){e?(this.gtaoMaterial.needsUpdate=this.gtaoMaterial.defines.SCENE_CLIP_BOX!==1,this.gtaoMaterial.defines.SCENE_CLIP_BOX=1,this.gtaoMaterial.uniforms.sceneBoxMin.value.copy(e.min),this.gtaoMaterial.uniforms.sceneBoxMax.value.copy(e.max)):(this.gtaoMaterial.needsUpdate=this.gtaoMaterial.defines.SCENE_CLIP_BOX===0,this.gtaoMaterial.defines.SCENE_CLIP_BOX=0)}updateGtaoMaterial(e){e.radius!==void 0&&(this.gtaoMaterial.uniforms.radius.value=e.radius),e.distanceExponent!==void 0&&(this.gtaoMaterial.uniforms.distanceExponent.value=e.distanceExponent),e.thickness!==void 0&&(this.gtaoMaterial.uniforms.thickness.value=e.thickness),e.distanceFallOff!==void 0&&(this.gtaoMaterial.uniforms.distanceFallOff.value=e.distanceFallOff,this.gtaoMaterial.needsUpdate=!0),e.scale!==void 0&&(this.gtaoMaterial.uniforms.scale.value=e.scale),e.samples!==void 0&&e.samples!==this.gtaoMaterial.defines.SAMPLES&&(this.gtaoMaterial.defines.SAMPLES=e.samples,this.gtaoMaterial.needsUpdate=!0),e.screenSpaceRadius!==void 0&&+!!e.screenSpaceRadius!==this.gtaoMaterial.defines.SCREEN_SPACE_RADIUS&&(this.gtaoMaterial.defines.SCREEN_SPACE_RADIUS=+!!e.screenSpaceRadius,this.gtaoMaterial.needsUpdate=!0)}updatePdMaterial(e){let t=!1;e.lumaPhi!==void 0&&(this.pdMaterial.uniforms.lumaPhi.value=e.lumaPhi),e.depthPhi!==void 0&&(this.pdMaterial.uniforms.depthPhi.value=e.depthPhi),e.normalPhi!==void 0&&(this.pdMaterial.uniforms.normalPhi.value=e.normalPhi),e.radius!==void 0&&e.radius!==this.radius&&(this.pdMaterial.uniforms.radius.value=e.radius),e.radiusExponent!==void 0&&e.radiusExponent!==this.pdRadiusExponent&&(this.pdRadiusExponent=e.radiusExponent,t=!0),e.rings!==void 0&&e.rings!==this.pdRings&&(this.pdRings=e.rings,t=!0),e.samples!==void 0&&e.samples!==this.pdSamples&&(this.pdSamples=e.samples,t=!0),t&&(this.pdMaterial.defines.SAMPLES=this.pdSamples,this.pdMaterial.defines.SAMPLE_VECTORS=L(this.pdSamples,this.pdRings,this.pdRadiusExponent),this.pdMaterial.needsUpdate=!0)}render(e,t,r){switch(this._renderGBuffer&&(this._overrideVisibility(),this._renderOverride(e,this.normalMaterial,this.normalRenderTarget,7829503,1),this._restoreVisibility()),this.gtaoMaterial.uniforms.cameraNear.value=this.camera.near,this.gtaoMaterial.uniforms.cameraFar.value=this.camera.far,this.gtaoMaterial.uniforms.cameraProjectionMatrix.value.copy(this.camera.projectionMatrix),this.gtaoMaterial.uniforms.cameraProjectionMatrixInverse.value.copy(this.camera.projectionMatrixInverse),this.gtaoMaterial.uniforms.cameraWorldMatrix.value.copy(this.camera.matrixWorld),this._renderPass(e,this.gtaoMaterial,this.gtaoRenderTarget,16777215,1),this.pdMaterial.uniforms.cameraProjectionMatrixInverse.value.copy(this.camera.projectionMatrixInverse),this._renderPass(e,this.pdMaterial,this.pdRenderTarget,16777215,1),this.output){case n.OUTPUT.Off:break;case n.OUTPUT.Diffuse:this.copyMaterial.uniforms.tDiffuse.value=r.texture,this.copyMaterial.blending=0,this._renderPass(e,this.copyMaterial,this.renderToScreen?null:t);break;case n.OUTPUT.AO:this.copyMaterial.uniforms.tDiffuse.value=this.gtaoRenderTarget.texture,this.copyMaterial.blending=0,this._renderPass(e,this.copyMaterial,this.renderToScreen?null:t);break;case n.OUTPUT.Denoise:this.copyMaterial.uniforms.tDiffuse.value=this.pdRenderTarget.texture,this.copyMaterial.blending=0,this._renderPass(e,this.copyMaterial,this.renderToScreen?null:t);break;case n.OUTPUT.Depth:this.depthRenderMaterial.uniforms.cameraNear.value=this.camera.near,this.depthRenderMaterial.uniforms.cameraFar.value=this.camera.far,this._renderPass(e,this.depthRenderMaterial,this.renderToScreen?null:t);break;case n.OUTPUT.Normal:this.copyMaterial.uniforms.tDiffuse.value=this.normalRenderTarget.texture,this.copyMaterial.blending=0,this._renderPass(e,this.copyMaterial,this.renderToScreen?null:t);break;case n.OUTPUT.Default:this.copyMaterial.uniforms.tDiffuse.value=r.texture,this.copyMaterial.blending=0,this._renderPass(e,this.copyMaterial,this.renderToScreen?null:t),this.blendMaterial.uniforms.intensity.value=this.blendIntensity,this.blendMaterial.uniforms.tDiffuse.value=this.pdRenderTarget.texture,this._renderPass(e,this.blendMaterial,this.renderToScreen?null:t);break;default:console.warn(`THREE.GTAOPass: Unknown output type.`)}}_renderPass(e,t,n,r,i){e.getClearColor(this._originalClearColor);let a=e.getClearAlpha(),o=e.autoClear;e.setRenderTarget(n),e.autoClear=!1,r!=null&&(e.setClearColor(r),e.setClearAlpha(i||0),e.clear()),this._fsQuad.material=t,this._fsQuad.render(e),e.autoClear=o,e.setClearColor(this._originalClearColor),e.setClearAlpha(a)}_renderOverride(e,t,n,r,i){e.getClearColor(this._originalClearColor);let a=e.getClearAlpha(),o=e.autoClear;e.setRenderTarget(n),e.autoClear=!1,r=t.clearColor||r,i=t.clearAlpha||i,r!=null&&(e.setClearColor(r),e.setClearAlpha(i||0),e.clear()),this.scene.overrideMaterial=t,e.render(this.scene,this.camera),this.scene.overrideMaterial=null,e.autoClear=o,e.setClearColor(this._originalClearColor),e.setClearAlpha(a)}_overrideVisibility(){let e=this.scene,t=this._visibilityCache;e.traverse(function(e){(e.isPoints||e.isLine||e.isLine2)&&e.visible&&(e.visible=!1,t.push(e))})}_restoreVisibility(){let e=this._visibilityCache;for(let t=0;t<e.length;t++)e[t].visible=!0;e.length=0}_generateNoise(e=64){let n=new z,r=e*e*4,i=new Uint8Array(r);for(let t=0;t<e;t++)for(let r=0;r<e;r++){let a=t,o=r;i[(t*e+r)*4]=(n.noise(a,o)*.5+.5)*255,i[(t*e+r)*4+1]=(n.noise(a+e,o)*.5+.5)*255,i[(t*e+r)*4+2]=(n.noise(a,o+e)*.5+.5)*255,i[(t*e+r)*4+3]=(n.noise(a+e,o+e)*.5+.5)*255}let a=new t(i,e,e,f,l);return a.wrapS=h,a.wrapT=h,a.needsUpdate=!0,a}};B.OUTPUT={Off:-1,Default:0,Diffuse:1,Depth:2,Normal:3,AO:4,Denoise:5};var V=.012,re=.35,ie=`
varying vec2 vSurface;
varying vec3 vAcross;
varying vec3 vAlong;
void main() {
  vSurface = position.xz; // the disc's own unit circle
  vAcross = normalize( normalMatrix * vec3( 1.0, 0.0, 0.0 ) );
  vAlong = normalize( normalMatrix * vec3( 0.0, 0.0, 1.0 ) );
  gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
}
`,ae=`
uniform sampler2D tBehind;
uniform sampler2D tDepth;
uniform vec2 uInvSize;
uniform float uTime;
uniform float uRipple;
uniform vec2 uImpact;
uniform float uShift;
uniform float uLens;
varying vec2 vSurface;
varying vec3 vAcross;
varying vec3 vAlong;
${S}
void main() {
  vec2 uv = gl_FragCoord.xy * uInvSize;
  if ( texture2D( tDepth, uv ).x < gl_FragCoord.z ) discard; // behind something solid
  vec3 wave = ripple( vSurface, uImpact, uTime, uRipple );
  vec3 tilt = wave.x * vAcross + wave.y * vAlong;
  vec2 at = uv - tilt.xy * uShift;
  if ( texture2D( tDepth, at ).x < gl_FragCoord.z ) at = uv; // never what stands in front
  float lens = 1.0 + uLens * wave.z;
  gl_FragColor = vec4( texture2D( tBehind, at ).rgb * lens, 1.0 );
}
`,oe=`
uniform sampler2D tBehind;
uniform sampler2D tDepth;
uniform vec2 uInvSize;
void main() {
  vec2 uv = gl_FragCoord.xy * uInvSize;
  if ( texture2D( tDepth, uv ).x < gl_FragCoord.z ) discard;
  gl_FragColor = vec4( texture2D( tBehind, uv ).rgb, 1.0 );
}
`,se=.014,ce=new p(`#e9f3f5`),le=`
#include <common>
varying vec3 vN;
varying vec3 vView;
void main() {
  #include <beginnormal_vertex>
  #include <defaultnormal_vertex>
  #include <begin_vertex>
  #include <project_vertex>
  vN = normalize( transformedNormal );
  vView = -mvPosition.xyz;
}
`,ue=`
#include <packing>
uniform sampler2D tBehind;
uniform sampler2D tDepth;
uniform vec2 uInvSize;
uniform vec3 uTint;
uniform float uBend;
uniform float uNear;
uniform float uFar;
varying vec3 vN;
varying vec3 vView;
void main() {
  vec2 uv = gl_FragCoord.xy * uInvSize;
  vec3 n = normalize( vN );
  float facing = abs( dot( n, normalize( vView ) ) );
  float edge = pow( 1.0 - facing, 3.0 );
  // Bent where it leans away; never into what stands in front of the glass (its colour would leak),
  // nor across an edge behind it: a thin thing in the glass (a thermometer's column) stays where it
  // is instead of the room far behind it showing in its place.
  vec2 bent = uv + n.xy * uBend * ( 1.0 - facing * facing );
  float there = texture2D( tDepth, bent ).x;
  float here = -perspectiveDepthToViewZ( texture2D( tDepth, uv ).x, uNear, uFar );
  float gap = abs( -perspectiveDepthToViewZ( there, uNear, uFar ) - here );
  vec2 at = there < gl_FragCoord.z || gap > 0.03 + 0.15 * here ? uv : bent;
  vec3 behind = texture2D( tBehind, at ).rgb;
  // The filter (finishes.ts): near-clear with a faint cast, darker towards the edge.
  vec3 through = mix( vec3( 1.0 ), uTint, 0.7 + 0.3 * edge ) * ( 1.0 - 0.45 * edge );
  gl_FragColor = vec4( behind * through, 1.0 );
}
`,H=`
varying vec2 vUv;
void main() { vUv = uv; gl_Position = vec4( position.xy, 0.0, 1.0 ); }`,U={tDepth:{value:null}},de=new m({uniforms:U,vertexShader:H,fragmentShader:`
uniform sampler2D tDepth;
varying vec2 vUv;
void main() {
  gl_FragDepth = texture2D( tDepth, vUv ).x;
  gl_FragColor = vec4( 0.0 ); // masked (colorWrite false); WebGL wants an output for the buffer
}`,depthTest:!0,depthFunc:1,depthWrite:!0,colorWrite:!1}),W={tParticles:{value:null}},fe=new m({uniforms:W,vertexShader:H,fragmentShader:`
uniform sampler2D tParticles;
varying vec2 vUv;
void main() { gl_FragColor = texture2D( tParticles, vUv ); }`,depthTest:!1,depthWrite:!1,blending:5,blendSrc:201,blendDst:205,blendSrcAlpha:200,blendDstAlpha:201}),pe=[];function G(e){for(let t=e;t;t=t.parent)if(!t.visible)return!1;return!0}var me=class extends E{camera;depth;through;glassIn={tBehind:{value:null},tDepth:{value:null},uInvSize:{value:new r},uTint:{value:ce},uBend:{value:se},uNear:{value:.1},uFar:{value:100}};glassMaterial=new m({uniforms:this.glassIn,vertexShader:le,fragmentShader:ue});rippleIn={tBehind:{value:null},tDepth:{value:null},uInvSize:{value:new r},uTime:{value:0},uRipple:{value:0},uImpact:{value:new r},uShift:{value:V},uLens:{value:re}};rippleMaterial=new m({uniforms:this.rippleIn,vertexShader:ie,fragmentShader:ae,side:2,depthTest:!1,depthWrite:!1});copyIn={tBehind:{value:null},tDepth:{value:null},uInvSize:{value:new r}};copyMaterial=new m({uniforms:this.copyIn,vertexShader:ie,fragmentShader:oe,side:2,depthTest:!1,depthWrite:!1});quad=new j;particles;clearColor=new p;frustum=new s;viewProjection=new n;constructor(e,t,n,r,i){super(),this.camera=e,this.depth=t,this.through=n,this.needsSwap=!1,this.particles=new d(Math.max(1,r>>1),Math.max(1,i>>1),{type:u,depthBuffer:!1});let a=this.particles;y(t,e.near,e.far,1/a.width,1/a.height,.5)}hide(){this.through.showGlass(!1),b(!1)}setSize(e,t){this.particles.setSize(Math.max(1,e>>1),Math.max(1,t>>1))}render(e,t,n){this.through.showGlass(!0),b(!0);let r=this.depth,i=this.camera,a=e.autoClear;e.autoClear=!1,e.getClearColor(this.clearColor);let o=e.getClearAlpha();try{this.viewProjection.multiplyMatrices(i.projectionMatrix,i.matrixWorldInverse),this.frustum.setFromProjectionMatrix(this.viewProjection),this.ripples(e,t,n),e.setRenderTarget(n);let a=this.through.glass(),o=!0;for(let s of a){if(!G(s)||!s.layers.test(i.layers)||s.frustumCulled&&!this.frustum.intersectsObject(s))continue;if(o){o=!1,U.tDepth.value=r,this.quad.material=de,this.quad.render(e);let a=this.glassIn;a.tBehind.value=t.texture,a.tDepth.value=r,a.uInvSize.value.set(1/n.width,1/n.height),a.uNear.value=i.near,a.uFar.value=i.far}let a=s.material;this.glassMaterial.side=Array.isArray(a)?0:a.side,s.material=this.glassMaterial,e.render(s,i),s.material=a}let s=this.particles,c=!1;for(let t of x())G(t)&&t.layers.test(i.layers)&&(c||(c=!0,y(r,i.near,i.far,1/s.width,1/s.height,.5),e.setRenderTarget(s),e.setClearColor(0,0),e.clear(!0,!1,!1)),e.render(t,i));c&&(e.setRenderTarget(n),W.tParticles.value=s.texture,this.quad.material=fe,this.quad.render(e))}finally{e.setClearColor(this.clearColor,o),e.autoClear=a}}ripples(e,t,n){let r=this.camera,i=this.rippleIn,a=!1;for(let{cap:o,surface:s}of this.through.stirred())o&&G(o)&&o.layers.test(r.layers)&&this.frustum.intersectsObject(o)&&(a||(a=!0,e.setRenderTarget(t),i.tBehind.value=n.texture,i.tDepth.value=this.depth,i.uInvSize.value.set(1/n.width,1/n.height)),i.uTime.value=s.uTime.value,i.uRipple.value=s.uRipple.value,i.uImpact.value.copy(s.uImpact.value),this.drawWith(e,o,this.rippleMaterial));if(!a)return;e.setRenderTarget(n);let o=this.copyIn;o.tBehind.value=t.texture,o.tDepth.value=this.depth,o.uInvSize.value.copy(i.uInvSize.value);for(let{cap:t}of this.through.stirred())t&&G(t)&&t.layers.test(r.layers)&&this.frustum.intersectsObject(t)&&this.drawWith(e,t,this.copyMaterial)}drawWith(e,t,n){let r=t.material,i=t.children;t.material=n,t.children=pe;try{e.render(t,this.camera)}finally{t.material=r,t.children=i}}dispose(){y(null,0,0,0,0,1),b(!0),this.through.showGlass(!0),this.particles.dispose(),this.glassMaterial.dispose(),this.rippleMaterial.dispose(),this.copyMaterial.dispose(),this.quad.dispose()}},he=class extends B{seeThrough=[];_overrideVisibility(){let e=this.seeThrough;this.scene.traverse(t=>{let n=t;if(!t.visible)return;let r=Array.isArray(n.material)?n.material[0]:n.material;(t.isPoints===!0||t.isLine===!0||r?.transparent===!0)&&(t.visible=!1,e.push(t))})}_restoreVisibility(){for(let e of this.seeThrough)e.visible=!0;this.seeThrough.length=0}_renderOverride(e,...t){let n=e.shadowMap.autoUpdate;e.shadowMap.autoUpdate=!1;try{ge.call(this,e,...t)}finally{e.shadowMap.autoUpdate=n}}},ge=B.prototype._renderOverride,K={uniforms:{tDiffuse:{value:null},warmth:{value:0},saturation:{value:1},contrast:{value:1}},vertexShader:`
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`,fragmentShader:`
uniform sampler2D tDiffuse;
uniform float warmth;
uniform float saturation;
uniform float contrast;
varying vec2 vUv;
void main() {
  vec4 c = texture2D(tDiffuse, vUv);
  vec3 balanced = c.rgb * vec3(1.0 + 0.06 * warmth, 1.0, 1.0 - 0.06 * warmth);
  vec3 saturated = mix(vec3(dot(balanced, vec3(0.2126, 0.7152, 0.0722))), balanced, saturation);
  gl_FragColor = vec4(clamp((saturated - 0.5) * contrast + 0.5, 0.0, 1.0), c.a);
}`},q=.002;function J(e,t,n,i,a,o={grade:!1,aoSamples:16,seeThrough:null}){let s=new d(i,a,{type:u,stencilBuffer:!0}),c=new T(e,s);c.setPixelRatio(1),c.setSize(i,a);let l=new A(new _,n);l.enabled=!1,c.addPass(l);let f=new A(t,n);c.addPass(f);let p=new he(t,n,i,a);p.updateGtaoMaterial({radius:w.ao.radius,distanceExponent:w.ao.distanceExponent,thickness:w.ao.thickness,scale:w.ao.scale,samples:o.aoSamples}),o.aoSamples!==16&&p.updatePdMaterial({samples:o.aoSamples}),p.blendIntensity=w.ao.blend,c.addPass(p);let m=o.seeThrough?new me(n,p.depthTexture,o.seeThrough,i,a):null;m&&c.addPass(m);let h=new M(new r(i,a),w.bloom.strength,w.bloom.radius,w.bloom.threshold);c.addPass(h),c.addPass(new D);let g=new k(K);g.enabled=!1,o.grade&&c.addPass(g),c.addPass(new ee);let v={warmth:0,saturation:1,contrast:1},y=g.uniforms;return{get target(){return c.readBuffer},render:(e,t=`neutral`,n=1)=>{if(o.grade){C(t,n,v);let r=e>0?1-Math.exp(-e/w.gradeEase):1;y.warmth.value+=(v.warmth-y.warmth.value)*r,y.saturation.value+=(v.saturation-y.saturation.value)*r,y.contrast.value+=(v.contrast-y.contrast.value)*r,g.enabled=Math.abs(y.warmth.value)>q||Math.abs(y.saturation.value-1)>q||Math.abs(y.contrast.value-1)>q}m?.hide(),c.render(e)},setUnder:(e,t)=>{l.enabled=e!==null&&t!==null,e&&t&&([l.scene,l.camera]=[e,t]),f.clear=!l.enabled,f.clearDepth=l.enabled},setSize:(e,t)=>c.setSize(e,t),dispose:()=>{for(let e of c.passes)e.dispose();c.dispose()}}}export{w as POST,J as createPost};