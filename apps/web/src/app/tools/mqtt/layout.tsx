import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "MQTT explorer · Tools",
  description: "Subscribe and publish via the API (paho-mqtt); optional SSH tunnel with PEM private key.",
};

export default function MqttToolLayout({ children }: { children: ReactNode }) {
  return children;
}
