"use client";

import { useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

import type { TrainingLogEntry } from "@/lib/ml/training-log-store";
import { loadTfVisFromCdn } from "@/lib/ml/tfjs-vis-cdn";

export type { TrainingLogEntry };

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  logs: TrainingLogEntry[];
  modelFromCache?: boolean;
  isTraining: boolean;
};

export function TfTrainingDrawer({
  open,
  onOpenChange,
  logs,
  modelFromCache = false,
  isTraining,
}: Props) {
  const t = useTranslations();
  const visOpenRef = useRef(false);
  const chartHostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open || !logs.length) return;

    let cancelled = false;

    async function renderCharts() {
      const tfvis = await loadTfVisFromCdn();
      if (cancelled) return;

      if (!visOpenRef.current) {
        tfvis.visor().open();
        visOpenRef.current = true;
      }

      const lossPoints = logs.map((l) => ({ x: l.epoch, y: l.loss }));
      const accPoints = logs.map((l) => ({
        x: l.epoch,
        y: (l.accuracy ?? 0) * 100,
      }));

      tfvis.render.linechart(
        {
          name: t("recommendation.trainingChartAccuracy"),
          tab: t("recommendation.trainingTab"),
        },
        { values: accPoints, series: ["accuracy"] },
        {
          xLabel: t("recommendation.trainingEpochAxis"),
          yLabel: t("recommendation.trainingAccuracyAxis"),
          height: 280,
        },
      );

      tfvis.render.linechart(
        {
          name: t("recommendation.trainingChartLoss"),
          tab: t("recommendation.trainingTab"),
        },
        { values: lossPoints, series: ["loss"] },
        {
          xLabel: t("recommendation.trainingEpochAxis"),
          yLabel: t("recommendation.trainingLossAxis"),
          height: 280,
        },
      );

      const host = chartHostRef.current;
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

  async function openTfVisor() {
    const tfvis = await loadTfVisFromCdn();
    tfvis.visor().open();
    visOpenRef.current = true;
  }

  const latest = logs[logs.length - 1];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetHeader>
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
          <Button type="button" variant="outline" size="sm" onClick={() => void openTfVisor()}>
            {t("recommendation.openTfVisor")}
          </Button>
          <div ref={chartHostRef} className="rounded-lg border border-border bg-card/60 p-3" />
          {!logs.length ? (
            <p className="text-sm text-muted-foreground">
              {isTraining
                ? t("recommendation.trainingDrawerEmpty")
                : t("recommendation.trainingDrawerNoLogs")}
            </p>
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  );
}
