import { View, Text } from "react-native";
import {
  CheckCircle,
  AlertCircle,
  Clock,
  Loader2,
  Plane,
  X,
  type LucideIcon,
} from "lucide-react-native";
import type { FlightStatus } from "@/types/flight";
import { colors } from "@/theme";

type StatusConfig = {
  label: string;
  textClass: string;
  bgClass: string;
  Icon: LucideIcon;
  iconColor: string;
};

export const STATUS_CONFIG: Record<FlightStatus, StatusConfig> = {
  scheduled: {
    label: "Scheduled",
    textClass: "text-slate-400",
    bgClass: "bg-slate-400/10",
    Icon: Clock,
    iconColor: colors.slate400,
  },
  "on-time": {
    label: "On Time",
    textClass: "text-emerald-400",
    bgClass: "bg-emerald-400/10",
    Icon: CheckCircle,
    iconColor: colors.emerald400,
  },
  delayed: {
    label: "Delayed",
    textClass: "text-amber-400",
    bgClass: "bg-amber-400/10",
    Icon: AlertCircle,
    iconColor: colors.amber400,
  },
  boarding: {
    label: "Boarding",
    textClass: "text-sky-400",
    bgClass: "bg-sky-400/10",
    Icon: Loader2,
    iconColor: colors.sky400,
  },
  "en-route": {
    label: "En Route",
    textClass: "text-emerald-400",
    bgClass: "bg-emerald-400/10",
    Icon: Plane,
    iconColor: colors.emerald400,
  },
  landed: {
    label: "Landed",
    textClass: "text-slate-400",
    bgClass: "bg-slate-400/10",
    Icon: CheckCircle,
    iconColor: colors.slate400,
  },
  cancelled: {
    label: "Cancelled",
    textClass: "text-red-400",
    bgClass: "bg-red-400/10",
    Icon: X,
    iconColor: colors.red400,
  },
};

export function StatusBadge({ status }: { status: FlightStatus }) {
  const cfg = STATUS_CONFIG[status];
  const { Icon } = cfg;
  return (
    <View
      className={`flex-row items-center gap-1.5 px-2.5 py-1 rounded-full self-start ${cfg.bgClass}`}
    >
      <Icon size={13} color={cfg.iconColor} />
      <Text className={`text-xs font-medium tracking-wide ${cfg.textClass}`}>
        {cfg.label}
      </Text>
    </View>
  );
}
