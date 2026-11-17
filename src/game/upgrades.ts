import type { UpgradeId, UpgradeOption } from "./types";

export const UPGRADE_CATALOG: UpgradeOption[] = [
  {
    id: "twin_cannons",
    name: "Nòng Pháo Kép",
    effectText: "Bắn thêm tia đạn song song theo hình quạt mỗi phát.",
    statDelta: "+1 Tia Đạn",
    maxStacks: 3,
    accentColor: "amber",
  },
  {
    id: "rapid_overclock",
    name: "Ép Xung Hỏa Lực",
    effectText: "Giảm thời gian hồi giữa các phát bắn và tăng tốc độ đạn.",
    statDelta: "+22% Tốc Độ Bắn",
    maxStacks: 4,
    accentColor: "amber",
  },
  {
    id: "ricochet_bolts",
    name: "Đạn Phản Xạ",
    effectText:
      "Đạn nảy lại khi chạm biên đấu trường để tiếp tục truy đuổi mục tiêu.",
    statDelta: "+1 Lần Nảy",
    maxStacks: 3,
    accentColor: "sky",
  },
  {
    id: "piercing_rounds",
    name: "Đạn Xuyên Giáp",
    effectText:
      "Tăng sát thương mỗi phát và xuyên qua thêm mục tiêu trên đường bay.",
    statDelta: "+25% Sát Thương · +1 Xuyên",
    maxStacks: 3,
    accentColor: "amber",
  },
  {
    id: "phase_dash_blast",
    name: "Lướt Xung Kích",
    effectText: "Tạo vòng sóng chấn động gây sát thương khi kết thúc pha lướt.",
    statDelta: "Giảm 20% Hồi Lướt",
    maxStacks: 3,
    accentColor: "sky",
  },
  {
    id: "shield_capacitor",
    name: "Tụ Khiên Năng Lượng",
    effectText: "Tăng giới hạn khiên bảo vệ và rút ngắn thời gian tự hồi phục.",
    statDelta: "+1 Khiên Tối Đa",
    maxStacks: 3,
    accentColor: "sky",
  },
  {
    id: "hull_plating",
    name: "Gia Cường Thân Tàu",
    effectText:
      "Nâng cấp giáp hợp kim tối đa và sửa chữa ngay toàn bộ hư hỏng.",
    statDelta: "+1 Giáp · Hồi Đầy Máu",
    maxStacks: 3,
    accentColor: "emerald",
  },
  {
    id: "orbital_drone",
    name: "Vệ Tinh Hộ Tống",
    effectText:
      "Triển khai vệ tinh bay quanh chiến cơ tự động bắn hạ kẻ địch gần.",
    statDelta: "+1 Vệ Tinh",
    maxStacks: 3,
    accentColor: "emerald",
  },
  {
    id: "core_magnet",
    name: "Trường Hút Tinh Thạch",
    effectText:
      "Mở rộng bán kính hút tinh thạch và tăng 15% năng lượng xung lực.",
    statDelta: "+65% Tầm Hút",
    maxStacks: 3,
    accentColor: "emerald",
  },
];

export function rollUpgradeChoices(
  currentStacks: Partial<Record<UpgradeId, number>>,
  count: number = 3,
): UpgradeOption[] {
  const available = UPGRADE_CATALOG.filter(
    (u) => (currentStacks[u.id] ?? 0) < u.maxStacks,
  );
  const pool = [...available];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, Math.min(count, pool.length));
}
