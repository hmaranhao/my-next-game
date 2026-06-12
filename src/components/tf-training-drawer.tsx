"use client";

import { useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  closeTfVisorIfOpen,
  loadTfVisFromCdn,
} from "@/lib/ml/tfjs-vis-cdn";

import type { TrainingLogEntry } from "@/lib/ml/training-log-store";

export type { TrainingLogEntry };

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  logs: TrainingLogEntry[];
  modelFromCache?: boolean;
  isTraining: boolean;
};

function waitForLayout(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });
}

export function TfTrainingDrawer({
  open,
  onOpenChange,
  logs,
  modelFromCache = false,
  isTraining,
}: Props) {
  const t = useTranslations();
  const lossChartRef = useRef<HTMLDivElement>(null);
  const accChartRef = useRef<HTMLDivElement>(null);
  const tableHostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) {
      void closeTfVisorIfOpen();
      return;
    }

    if (!logs.length) return;

    let cancelled = false;

    async function renderCharts() {
      await closeTfVisorIfOpen();
      const tfvis = await loadTfVisFromCdn();
      if (cancelled) return;

      await waitForLayout();
      if (cancelled) return;

      const lossHost = lossChartRef.current;
      const accHost = accChartRef.current;
      const chartWidth = Math.max(
        280,
        accHost?.clientWidth ?? lossHost?.clientWidth ?? 320,
      );

      const lossPoints = logs.map((l) => ({ x: l.epoch, y: l.loss }));
      const accPoints = logs.map((l) => ({
        x: l.epoch,
        y: (l.accuracy ?? 0) * 100,
      }));

      if (accHost) {
        accHost.innerHTML = "";
        await tfvis.render.linechart(
          accHost,
          { values: accPoints, series: ["accuracy"] },
          {
            xLabel: t("recommendation.trainingEpochAxis"),
            yLabel: t("recommendation.trainingAccuracyAxis"),
            height: 220,
            width: chartWidth,
          },
        );
      }

      if (lossHost) {
        lossHost.innerHTML = "";
        await tfvis.render.linechart(
          lossHost,
          { values: lossPoints, series: ["loss"] },
          {
            xLabel: t("recommendation.trainingEpochAxis"),
            yLabel: t("recommendation.trainingLossAxis"),
            height: 220,
            width: chartWidth,
          },
        );
      }

      const host = tableHostRef.current;
      if (host) {
        host.innerHTML = "";
        const table = document.createElement("table");
        table.className = "w-full text-xs";
        const header = document.createElement("tr");
        header.innerHTML =
          "<th class='text-left py-1'>Época</th><th class='text-right py-1'>Loss</th><th class='text-right py-1'>Acc</th>";
        table.appendChild(header);
        for (const log of logs.slice(-12)) {
          const row = document.createElement("tr");
          row.innerHTML = `<td class='py-1'>${log.epoch + 1}</td><td class='text-right py-1'>${log.loss.toFixed(4)}</td><td class='text-right py-1'>${((log.accuracy ?? 0) * 100).toFixed(1)}%</td>`;
          table.appendChild(row);
        }
        host.appendChild(table);
      }
    }

    void renderCharts();

    return () => {
      cancelled = true;
    };
  }, [open, logs, t]);

  const latest = logs[logs.length - 1];

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      data-testid="training-drawer"
    >
      <SheetHeader>
        <SheetClose
          label={t("recommendation.closeDrawer")}
          onClick={() => onOpenChange(false)}
        />
        <SheetTitle>{t("recommendation.trainingDrawerTitle")}</SheetTitle>
        {isTraining ? (
          <p className="text-xs text-muted-foreground">
            {t("recommendation.trainingDrawerActive")}
          </p>
        ) : latest ? (
          <p className="text-xs text-muted-foreground">
            {modelFromCache ? `${t("recommendation.trainingDrawerRestored")} · ` : ""}
            {t("recommendation.epoch", { epoch: latest.epoch + 1 })} · loss{" "}
            {latest.loss.toFixed(4)} · acc{" "}
            {((latest.accuracy ?? 0) * 100).toFixed(1)}%
          </p>
        ) : modelFromCache ? (
          <p className="text-xs text-muted-foreground">
            {t("recommendation.trainingDrawerCached")}
          </p>
        ) : null}
      </SheetHeader>
      <SheetContent>
        <div className="space-y-4">
          {logs.length > 0 ? (
            <>
              <div className="space-y-3">
                <div>
                  <p className="mb-1 text-xs font-medium text-muted-foreground">
                    {t("recommendation.trainingChartAccuracy")}
                  </p>
                  <div
                    ref={accChartRef}
                    className="w-full min-h-[220px] rounded-lg border border-border bg-card/60 p-2"
                  />
                </div>
                <div>
                  <p className="mb-1 text-xs font-medium text-muted-foreground">
                    {t("recommendation.trainingChartLoss")}
                  </p>
                  <div
                    ref={lossChartRef}
                    className="w-full min-h-[220px] rounded-lg border border-border bg-card/60 p-2"
                  />
                </div>
              </div>
              <div
                ref={tableHostRef}
                className="rounded-lg border border-border bg-card/60 p-3"
              />
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              {isTraining
                ? t("recommendation.trainingDrawerEmpty")
                : t("recommendation.trainingDrawerNoLogs")}
            </p>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
