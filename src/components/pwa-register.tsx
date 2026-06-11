"use client";

import { useEffect } from "react";

export function PwaRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {
      // PWA enhancement — non-blocking if registration fails (e.g. dev HTTP)
    });
  }, []);

  return null;
}
