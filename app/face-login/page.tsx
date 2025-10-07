"use client";
import { useRouter } from "next/navigation";
import { FaceLogin } from "@/components/FaceLogin";

export default function FaceLoginPage() {
  const router = useRouter();
  return <FaceLogin onBack={() => router.push("/")} />;
}
