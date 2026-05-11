import type { Handler } from './dispatch.js';
import { asAddress, asNumber, asString } from './parse.js';

export const handleReviewPosted: Handler = async (event, ctx) => {
  const f = event.parsedJson;
  await ctx.storage.insertReview({
    reviewObjectId: asString(f.review_id, 'review_id'),
    serverObjectId: asString(f.server_id, 'server_id'),
    reviewerAddress: asAddress(f.reviewer, 'reviewer'),
    ratingX10: asNumber(f.rating_x10, 'rating_x10'),
    txDigest: event.txDigest,
  });
};
