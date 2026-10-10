/**
 * The ring of the logo's "o" (DIRECAO › Logo): viewBox 24, radius 9, stroke
 * 4, round cap, the track at 22% of the arc's color. The same drawing
 * measures progress where space is short (ProgressRing) and makes the app
 * icon.
 */
export const RING = { box: 24, center: 12, radius: 9, strokeWidth: 4 } as const;

export const RING_CIRCUMFERENCE = 2 * Math.PI * RING.radius;

/** The logo's arc: ~70% of the ring, the opening turned to the lower right. */
export const LOGO_ARC = { dashArray: "40 57", rotation: 125 } as const;

/** The track's share of the arc's color, in percent. */
export const TRACK_MIX = 22;
