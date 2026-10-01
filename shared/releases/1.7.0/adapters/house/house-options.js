import { makeRng } from "@engine/rng.js";
export function enrichHouse(params, legacy = false) {
  const p = structuredClone(params),
    r = makeRng(p.seed ^ 0xd1b54a35),
    type = p.archetype;
  return {
    ...p,
    detailVersion: legacy ? 0 : 1,
    roofOn: true,
    windows: true,
    doorOn: true,
    yard: true,
    trees: true,
    dormers: !legacy && ["cottage", "suburban", "cabin"].includes(type),
    balcony: !legacy && ["villa", "townhouse"].includes(type),
    garage: !legacy && type === "suburban",
    shutters: !legacy && ["cottage", "villa"].includes(type),
    windowType: legacy
      ? "classic"
      : type === "villa"
        ? "arched"
        : type === "townhouse"
          ? "wide"
          : type === "cabin"
            ? "classic"
            : r() < 0.25
              ? "arched"
              : "classic",
    trimOn: true,
  };
}
const bool = { type: "boolean" };
export const HOUSE_SCHEMA = {
  detailVersion: { type: "enum", values: [0, 1] },
  roofOn: bool,
  windows: bool,
  doorOn: bool,
  yard: bool,
  trees: bool,
  dormers: bool,
  balcony: bool,
  garage: bool,
  shutters: bool,
  trimOn: bool,
  roofType: {
    type: "enum",
    values: ["gable", "hip", "flat", "pyramid", "shed", "gambrel"],
  },
  windowType: { type: "enum", values: ["classic", "wide", "arched", "round"] },
};
const pitched = (p) =>
  p.roofOn && p.roofType !== "flat" && p.detailVersion === 1;
export const HOUSE_OPTIONS = [
  {
    key: "detailVersion",
    label: "Detail level",
    values: [
      { value: 1, label: "Architectural" },
      { value: 0, label: "Original" },
    ],
  },
  {
    key: "roofType",
    label: "Roof shape",
    values: ["gable", "hip", "flat", "pyramid", "shed", "gambrel"].map(
      (value) => ({ value, label: value[0].toUpperCase() + value.slice(1) }),
    ),
  },
  {
    key: "windowType",
    label: "Window shape",
    values: ["classic", "wide", "arched", "round"].map((value) => ({
      value,
      label: value[0].toUpperCase() + value.slice(1),
    })),
    available: (p) => p.detailVersion === 1 && p.windows,
  },
  { key: "dormers", label: "Dormers", available: pitched },
  {
    key: "balcony",
    label: "Balcony",
    available: (p) => p.detailVersion === 1 && p.storeys >= 2,
  },
  { key: "garage", label: "Garage", available: (p) => p.detailVersion === 1 },
  {
    key: "shutters",
    label: "Shutters",
    available: (p) => p.detailVersion === 1 && p.windows,
  },
  { key: "roofOn", label: "Main roof" },
  { key: "windows", label: "Windows" },
  { key: "doorOn", label: "Door" },
  { key: "porch", label: "Porch" },
  { key: "chimney", label: "Chimney", available: (p) => p.roofOn },
  {
    key: "trimOn",
    label: "Facade trim",
    available: (p) => p.detailVersion === 1,
  },
  { key: "yard", label: "Ground plot" },
  { key: "trees", label: "Trees", available: (p) => p.yard },
];
