/* ============================================================
   SHIPS — engine nozzle layout for the player fleet
   ------------------------------------------------------------
   Every player hull is an authored glTF model now. The only data
   kept here is where each hull's thrusters sit, expressed in
   local model space as a fraction of the ship's normalised size.

   Local convention: +Y is up, the nose points +Z on most hulls
   (the Gunship is authored nose -Z), and the engines sit at the
   opposite end. loadShip() yaws each model so the nose always
   points -Z (up-screen) in combat and the nozzles point +Z.
   ============================================================ */

/** Engine nozzle offsets in ship-size fractions (local model space). */
export const SHIP_ENGINES = {
  scout: [
    { x: -0.34, z: -0.45 },
    { x: -0.12, z: -0.47 },
    { x: 0.12, z: -0.47 },
    { x: 0.34, z: -0.45 }
  ],
  fighter: [
    { x: -0.3, z: -0.5 },
    { x: 0, z: -0.5 },
    { x: 0.3, z: -0.5 }
  ],
  destroyer: [
    { x: -0.26, z: -0.52 },
    { x: 0, z: -0.54 },
    { x: 0.26, z: -0.52 }
  ],
  titan: [
    { x: 0.44, z: -0.3 },
    { x: 0.47, z: -0.1 },
    { x: 0.47, z: 0.1 },
    { x: 0.44, z: 0.3 }
  ],
  phantom: [
    { x: -0.33, z: -0.5 },
    { x: 0.33, z: -0.5 }
  ],
  interceptor: [
    { x: -0.18, z: -0.25 },
    { x: 0.18, z: -0.25 }
  ],
  gunship: [
    { x: -0.18, z: 0.44 },
    { x: 0, z: 0.47 },
    { x: 0.18, z: 0.44 }
  ],
  dreadnought: [
    { x: -0.22, z: -0.47 },
    { x: 0, z: -0.49 },
    { x: 0.22, z: -0.47 }
  ]
};

export function engineMounts(modelKey) {
  return SHIP_ENGINES[modelKey] || SHIP_ENGINES.fighter;
}
