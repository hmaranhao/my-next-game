type TfVisModule = {
  visor: () => { open: () => void };
  render: {
    linechart: (
      surface: { name: string; tab: string },
      data: { values: Array<{ x: number; y: number }>; series: string[] },
      opts: { xLabel: string; yLabel: string; height: number },
    ) => void;
  };
};

declare global {
  interface Window {
    tfvis?: TfVisModule;
  }
}

const TF_CDN =
  "https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.22.0/dist/tf.min.js";
const TFVIS_CDN =
  "https://cdn.jsdelivr.net/npm/@tensorflow/tfjs-vis@1.5.1/dist/tfjs-vis.umd.min.js";

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) {
      resolve();
      return;
    }
    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Failed to load ${src}`));
    document.head.appendChild(script);
  });
}

/** Browser-only tfjs-vis (CDN) — keeps Worker bundle under size limits. */
export async function loadTfVisFromCdn(): Promise<TfVisModule> {
  if (typeof window === "undefined") {
    throw new Error("tfjs-vis is only available in the browser");
  }
  if (window.tfvis) return window.tfvis;

  await loadScript(TF_CDN);
  await loadScript(TFVIS_CDN);

  if (!window.tfvis) {
    throw new Error("tfjs-vis failed to initialize");
  }

  return window.tfvis;
}
