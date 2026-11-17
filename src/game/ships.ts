import type { ShipId } from "./types";

export interface ShipExhaustProfile {
  label: string;
  primaryHex: string;
  secondaryHex: string;
  coreRgb: string;
  innerRgb: string;
  wingtipRgb: string;
  style: "ember_jet" | "twin_ion" | "bastion_plume";
}

export interface ShipSpec {
  id: ShipId;
  name: string;
  roleLabel: string;
  accentColor: string;
  accentTone: "amber" | "sky" | "emerald";
  exhaust: ShipExhaustProfile;
  maxSpeed: number;
  accel: number;
  dashCooldownMax: number;
  fireInterval: number;
  baseBarrels: number;
  spreadStep: number;
  bulletSpeed: number;
  baseDamage: number;
  shieldRegenDelay: number;
  hpDelta: number;
  shieldDelta: number;
  statsDisplay: {
    speed: string;
    spread: string;
    shieldRegen: string;
    vitals: string;
  };
  statBars: {
    speed: number;
    firepower: number;
    shieldRegen: number;
  };
}

export const SHIP_SPECS: ShipSpec[] = [
  {
    id: "interceptor",
    name: "Tiêm kích Phượng Hoàng",
    roleLabel: "Cân bằng · Cơ động ổn định",
    accentColor: "#F59E0B",
    accentTone: "amber",
    exhaust: {
      label: "Luồng lửa Hổ phách",
      primaryHex: "#F59E0B",
      secondaryHex: "#FDE68A",
      coreRgb: "245, 158, 11",
      innerRgb: "254, 243, 199",
      wingtipRgb: "251, 191, 36",
      style: "ember_jet",
    },
    maxSpeed: 345,
    accel: 2200,
    dashCooldownMax: 1.55,
    fireInterval: 0.165,
    baseBarrels: 1,
    spreadStep: 0.11,
    bulletSpeed: 760,
    baseDamage: 16,
    shieldRegenDelay: 5.0,
    hpDelta: 0,
    shieldDelta: 0,
    statsDisplay: {
      speed: "345 px/s",
      spread: "1 tia · 0.11",
      shieldRegen: "5.0s",
      vitals: "4 Giáp / 2 Khiên",
    },
    statBars: {
      speed: 72,
      firepower: 72,
      shieldRegen: 60,
    },
  },
  {
    id: "striker",
    name: "Xung kích Bão Tố",
    roleLabel: "Tốc độ cao · Đạn chùm đôi",
    accentColor: "#38BDF8",
    accentTone: "sky",
    exhaust: {
      label: "Plasma Lam Bão",
      primaryHex: "#38BDF8",
      secondaryHex: "#E0F2FE",
      coreRgb: "56, 189, 248",
      innerRgb: "224, 242, 254",
      wingtipRgb: "125, 211, 252",
      style: "twin_ion",
    },
    maxSpeed: 405,
    accel: 2650,
    dashCooldownMax: 1.3,
    fireInterval: 0.185,
    baseBarrels: 2,
    spreadStep: 0.17,
    bulletSpeed: 820,
    baseDamage: 12,
    shieldRegenDelay: 6.0,
    hpDelta: -1,
    shieldDelta: 0,
    statsDisplay: {
      speed: "405 px/s",
      spread: "2 tia · 0.17",
      shieldRegen: "6.0s",
      vitals: "3 Giáp / 2 Khiên",
    },
    statBars: {
      speed: 96,
      firepower: 88,
      shieldRegen: 46,
    },
  },
  {
    id: "aegis",
    name: "Pháo đài Aegis",
    roleLabel: "Giáp dày · Hồi khiên cực nhanh",
    accentColor: "#34D399",
    accentTone: "emerald",
    exhaust: {
      label: "Ion Ngọc Lục Bảo",
      primaryHex: "#34D399",
      secondaryHex: "#A7F3D0",
      coreRgb: "52, 211, 153",
      innerRgb: "209, 250, 229",
      wingtipRgb: "110, 231, 183",
      style: "bastion_plume",
    },
    maxSpeed: 295,
    accel: 1850,
    dashCooldownMax: 1.8,
    fireInterval: 0.145,
    baseBarrels: 1,
    spreadStep: 0.06,
    bulletSpeed: 740,
    baseDamage: 19,
    shieldRegenDelay: 2.8,
    hpDelta: 1,
    shieldDelta: 1,
    statsDisplay: {
      speed: "295 px/s",
      spread: "1 tia · 0.06",
      shieldRegen: "2.8s",
      vitals: "5 Giáp / 3 Khiên",
    },
    statBars: {
      speed: 54,
      firepower: 78,
      shieldRegen: 96,
    },
  },
];

export function getShipSpec(id: ShipId): ShipSpec {
  return SHIP_SPECS.find((ship) => ship.id === id) ?? SHIP_SPECS[0];
}
