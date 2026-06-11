/** Social proof / catalog eligibility tests */

import {
  isCatalogEligible,
  isCasualGame,
  isIndieLabeledGame,
} from "./catalog-eligibility.mjs";

function passesSocialProofFloor(game) {
  return isCatalogEligible(game);
}

const microGame = {
  positiveReviews: 6,
  recommendations: 0,
  estimatedOwnersMid: 50_000,
};

const evilQuest = {
  positiveReviews: 580,
  recommendations: 511,
  estimatedOwnersMid: 75_000,
};

const curatedHit = {
  positiveReviews: 550_000,
  recommendations: 520_000,
  estimatedOwnersMid: 3_000_000,
  genre: "Action",
  tags: ["FPS"],
};

const ownersOnly5k = {
  positiveReviews: 5_200,
  recommendations: 1_500,
  estimatedOwnersMid: 1_500_000,
  genre: "Action",
  tags: [],
};

const ownersWithoutSocial = {
  positiveReviews: 2_000,
  recommendations: 1_500,
  estimatedOwnersMid: 2_000_000,
  genre: "Action",
  tags: [],
};

const recsOnly = {
  positiveReviews: 50_000,
  recommendations: 250_000,
  estimatedOwnersMid: 1_200_000,
  genre: "Action",
  tags: [],
};

if (passesSocialProofFloor(microGame)) {
  throw new Error("micro game should not pass");
}

if (passesSocialProofFloor(evilQuest)) {
  throw new Error("EvilQuest should not pass curated floor");
}

if (!passesSocialProofFloor(curatedHit)) {
  throw new Error("mega-hit should pass curated floor");
}

if (passesSocialProofFloor(ownersOnly5k)) {
  throw new Error("1.5M owners + 5k reviews should not pass 500k floor");
}

if (passesSocialProofFloor(ownersWithoutSocial)) {
  throw new Error("2M owners without 500k reviews/recs should not pass");
}

const recsOnlyPass = {
  positiveReviews: 50_000,
  recommendations: 520_000,
  estimatedOwnersMid: 1_200_000,
  genre: "Action",
  tags: [],
};

if (!passesSocialProofFloor(recsOnlyPass)) {
  throw new Error("1.2M owners + 520k recs should pass");
}

if (passesSocialProofFloor(recsOnly)) {
  throw new Error("1.2M owners + 250k recs should not pass 500k floor");
}

const below500k = {
  positiveReviews: 450_000,
  recommendations: 480_000,
  estimatedOwnersMid: 2_000_000,
  genre: "Action",
  tags: [],
};

if (passesSocialProofFloor(below500k)) {
  throw new Error("450k/480k should not pass 500k floor");
}

const casualHit = {
  positiveReviews: 600_000,
  recommendations: 600_000,
  estimatedOwnersMid: 2_000_000,
  genre: "Casual, Puzzle",
  tags: ["Puzzle"],
};

if (passesSocialProofFloor(casualHit)) {
  throw new Error("Casual genre should be excluded");
}

const casualTagOnly = {
  positiveReviews: 600_000,
  recommendations: 600_000,
  estimatedOwnersMid: 2_000_000,
  genre: "Action",
  tags: ["Casual", "FPS"],
};

if (passesSocialProofFloor(casualTagOnly)) {
  throw new Error("Casual tag should be excluded");
}

const indieBelow1m = {
  positiveReviews: 800_000,
  recommendations: 900_000,
  estimatedOwnersMid: 1_500_000,
  genre: "Action, Indie",
  tags: [],
};

if (passesSocialProofFloor(indieBelow1m)) {
  throw new Error("indie-labeled game below 1M social proof should not pass");
}

const indieAt1m = {
  positiveReviews: 1_050_000,
  recommendations: 200_000,
  estimatedOwnersMid: 1_500_000,
  genre: "Action, Indie",
  tags: [],
};

if (!passesSocialProofFloor(indieAt1m)) {
  throw new Error("indie-labeled game with 1M+ reviews should pass");
}

if (!isCasualGame(casualTagOnly)) {
  throw new Error("isCasualGame should detect Casual tag");
}

if (!isIndieLabeledGame(indieAt1m)) {
  throw new Error("isIndieLabeledGame should detect Indie genre");
}

console.log("social proof tests OK");
