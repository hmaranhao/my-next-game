/** Social proof / catalog eligibility tests */

import { isCatalogEligible, isCasualGame } from "./catalog-eligibility.mjs";

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
  positiveReviews: 250_000,
  recommendations: 220_000,
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
  throw new Error("established hit should pass curated floor");
}

if (passesSocialProofFloor(ownersOnly5k)) {
  throw new Error("1.5M owners + 5k reviews should not pass without publisher");
}

if (passesSocialProofFloor(ownersWithoutSocial)) {
  throw new Error("2M owners without social proof should not pass");
}

if (!passesSocialProofFloor(recsOnly)) {
  throw new Error("1.2M owners + 250k recs should pass");
}

const below200k = {
  positiveReviews: 180_000,
  recommendations: 190_000,
  estimatedOwnersMid: 2_000_000,
  genre: "Action",
  tags: [],
};

if (passesSocialProofFloor(below200k)) {
  throw new Error("180k/190k should not pass 200k floor");
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

const publisherBacked = {
  positiveReviews: 120_000,
  recommendations: 80_000,
  estimatedOwnersMid: 1_500_000,
  genre: "Action",
  tags: [],
  publisher: "Ubisoft Entertainment",
};

if (!passesSocialProofFloor(publisherBacked)) {
  throw new Error("major publisher + 120k reviews should pass");
}

const indieHitNoPublisher = {
  positiveReviews: 800_000,
  recommendations: 900_000,
  estimatedOwnersMid: 1_500_000,
  genre: "Action, Indie",
  tags: [],
  publisher: "Team Cherry",
};

if (!passesSocialProofFloor(indieHitNoPublisher)) {
  throw new Error("800k reviews without major publisher should still pass");
}

if (!isCasualGame(casualTagOnly)) {
  throw new Error("isCasualGame should detect Casual tag");
}

console.log("social proof tests OK");
