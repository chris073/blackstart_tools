import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Modbus TCP · Tools",
  description: "Connect to a Modbus TCP device and poll a single coil, discrete input, or register.",
};

export default function ModbusToolLayout({ children }: { children: ReactNode }) {
  return children;
}
