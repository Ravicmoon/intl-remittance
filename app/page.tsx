"use client";
import { useRouter } from "next/navigation";
import RemittanceMain from "@/components/RemittanceMain";

export default function Page() {
  const router = useRouter();
  return <RemittanceMain onStartFaceLogin={() => router.push("/face-login")} />;
}
