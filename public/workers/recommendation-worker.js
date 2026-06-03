import "https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.22.0/dist/tf.min.js";

const INPUT_DIM = 256;
const STORAGE_KEY = "indexeddb://my-next-game-model";

const events = {
  progress: "progress",
  trainingLog: "trainingLog",
  complete: "complete",
  error: "error",
};

/** @param {Array<{input: number[], label: number}>} rows */
async function configureAndTrain(rows) {
  if (!rows.length) {
    throw new Error("No training rows");
  }

  const xs = tf.tensor2d(rows.map((r) => r.input));
  const ys = tf.tensor2d(
    rows.map((r) => r.label),
    [rows.length, 1],
  );

  const model = tf.sequential();
  model.add(
    tf.layers.dense({ inputShape: [INPUT_DIM], units: 128, activation: "relu" }),
  );
  model.add(tf.layers.dense({ units: 64, activation: "relu" }));
  model.add(tf.layers.dense({ units: 32, activation: "relu" }));
  model.add(tf.layers.dense({ units: 1, activation: "sigmoid" }));

  model.compile({
    optimizer: tf.train.adam(0.01),
    loss: "binaryCrossentropy",
    metrics: ["accuracy"],
  });

  const epochs = rows.length > 2000 ? 40 : 60;

  await model.fit(xs, ys, {
    epochs,
    batchSize: 32,
    shuffle: true,
    callbacks: {
      onEpochEnd: (epoch, logs) => {
        postMessage({
          type: events.trainingLog,
          epoch,
          loss: logs.loss,
          accuracy: logs.acc,
        });
        const pct = Math.round(((epoch + 1) / epochs) * 90);
        postMessage({ type: events.progress, progress: pct });
      },
    },
  });

  xs.dispose();
  ys.dispose();

  await model.save(STORAGE_KEY);

  return model;
}

/** @param {tf.LayersModel} model */
function predictCandidates(model, profileVector, candidates) {
  const inputs = candidates.map((c) => [...profileVector, ...c.gameVector]);
  const inputTensor = tf.tensor2d(inputs);
  const predictions = model.predict(inputTensor);
  const scores = predictions.dataSync();
  inputTensor.dispose();
  predictions.dispose();

  let bestIdx = 0;
  for (let i = 1; i < scores.length; i++) {
    if (scores[i] > scores[bestIdx]) bestIdx = i;
  }

  return candidates.map((c, i) => ({
    gameId: c.gameId,
    name: c.name,
    genre: c.genre,
    platform: c.platform,
    rating: c.rating,
    score: scores[i],
  })).sort((a, b) => b.score - a.score);
}

async function loadOrTrain(rows, skipTrain) {
  if (!skipTrain) {
    try {
      const loaded = await tf.loadLayersModel(STORAGE_KEY);
      postMessage({ type: events.progress, progress: 15 });
      return loaded;
    } catch {
      // train fresh
    }
  }

  postMessage({ type: events.progress, progress: 5 });
  return configureAndTrain(rows);
}

async function trainAndRecommend(data) {
  const { profileVector, candidates, trainingRows, retrain } = data;

  if (!profileVector?.length || !candidates?.length) {
    throw new Error("Missing profileVector or candidates");
  }

  const model = await loadOrTrain(trainingRows ?? [], Boolean(retrain));
  postMessage({ type: events.progress, progress: 92 });

  const ranked = predictCandidates(model, profileVector, candidates);
  const top = ranked[0];
  const matchPercent = Math.round(Math.min(100, Math.max(0, top.score * 100)));

  postMessage({
    type: events.complete,
    recommendation: {
      gameId: top.gameId,
      name: top.name,
      genre: top.genre,
      platform: top.platform,
      rating: top.rating,
      matchPercent,
    },
    ranked: ranked.slice(0, 5),
  });
  postMessage({ type: events.progress, progress: 100 });
}

self.onmessage = async (e) => {
  const { action, ...payload } = e.data;
  if (action !== "trainAndRecommend") return;

  try {
    await trainAndRecommend(payload);
  } catch (err) {
    postMessage({
      type: events.error,
      message: err instanceof Error ? err.message : "Worker error",
    });
  }
};
