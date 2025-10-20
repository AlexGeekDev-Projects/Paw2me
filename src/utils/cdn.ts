// utils/cdn.ts
export type CdnProvider =
  | 'auto'
  | 'cloudflare'
  | 'imgix'
  | 'cloudinary'
  | 'thumbor'
  | 'generic';

export type CdnOpts = Readonly<{
  w?: number; // objetivo en px (displayWidth * DPR)
  h?: number; // opcional; si lo omites, el recorte lo hace "cover"
  q?: number; // calidad 1..100
  fit?: 'cover' | 'fill' | 'inside' | 'outside';
  gravity?: 'center' | 'faces' | 'entropy' | 'auto'; // smart crop cuando se pueda
  dpr?: number; // devicePixelRatio
}>;

function host(u: string): string {
  try {
    return new URL(u).host.toLowerCase();
  } catch {
    return '';
  }
}

export function buildCdnUrl(
  url: string,
  opts: CdnOpts,
  provider: CdnProvider = 'auto',
): string {
  if (!url) return url;
  const h = host(url);
  const p: CdnProvider =
    provider !== 'auto'
      ? provider
      : h.includes('cloudflare') || h.includes('cf-ipfs') || h.includes('cfcdn')
        ? 'cloudflare'
        : h.includes('imgix.net')
          ? 'imgix'
          : h.includes('cloudinary.com')
            ? 'cloudinary'
            : h.includes('thumbor')
              ? 'thumbor'
              : 'generic';

  const { w, h: H, q = 75, fit = 'cover', gravity = 'auto', dpr = 1 } = opts;

  try {
    switch (p) {
      case 'cloudflare': {
        // cf-image: ?width=&height=&quality=&fit=&gravity=
        const u = new URL(url);
        if (w) u.searchParams.set('width', String(w));
        if (H) u.searchParams.set('height', String(H));
        u.searchParams.set('quality', String(q));
        u.searchParams.set('fit', fit);
        if (gravity !== 'center') u.searchParams.set('gravity', gravity);
        u.searchParams.set('dpr', dpr.toFixed(2));
        return u.toString();
      }
      case 'imgix': {
        const u = new URL(url);
        if (w) u.searchParams.set('w', String(w));
        if (H) u.searchParams.set('h', String(H));
        u.searchParams.set('q', String(q));
        u.searchParams.set('fit', fit === 'cover' ? 'crop' : fit);
        const g =
          gravity === 'faces'
            ? 'faces'
            : gravity === 'entropy'
              ? 'entropy'
              : 'center';
        u.searchParams.set('crop', g === 'center' ? 'focalpoint' : g);
        u.searchParams.set('dpr', dpr.toFixed(2));
        return u.toString();
      }
      case 'cloudinary': {
        // .../upload/ -> insertar transformación e.g. /upload/c_fill,g_auto,f_auto,q_75,w_1080/...
        const m = url.match(/(\/upload\/)(.*)/);
        if (!m) return url;
        const trans: string[] = [];
        trans.push(
          fit === 'cover' ? 'c_fill' : fit === 'inside' ? 'c_fit' : 'c_limit',
        );
        trans.push(
          gravity === 'faces'
            ? 'g_faces'
            : gravity === 'entropy'
              ? 'g_auto:adv'
              : 'g_auto',
        );
        trans.push(`q_${q}`);
        if (w) trans.push(`w_${w}`);
        if (H) trans.push(`h_${H}`);
        trans.push('f_auto'); // formato óptimo
        return url.replace('/upload/', `/upload/${trans.join(',')}/`);
      }
      case 'thumbor': {
        // /unsafe/<w>x<h>/smart/...
        // Si no controlas el proxy, vuelve a url
        if (!w) return url;
        const u = new URL(url);
        // naive: agrega params genéricos
        u.searchParams.set('w', String(w));
        if (H) u.searchParams.set('h', String(H));
        u.searchParams.set('q', String(q));
        return u.toString();
      }
      default: {
        const u = new URL(url);
        if (w) u.searchParams.set('w', String(w));
        if (H) u.searchParams.set('h', String(H));
        u.searchParams.set('q', String(q));
        u.searchParams.set('fit', fit);
        if (gravity !== 'center') u.searchParams.set('gravity', gravity);
        u.searchParams.set('dpr', dpr.toFixed(2));
        return u.toString();
      }
    }
  } catch {
    return url;
  }
}
