import {
  AppBskyEmbedExternal,
  AppBskyEmbedImages,
  AppBskyEmbedRecord,
  AppBskyEmbedRecordWithMedia,
  AppBskyFeedPost,
  AppBskyRichtextFacet,
  BlobRef,
  BskyAgent,
  ComAtprotoLabelDefs,
  ComAtprotoRepoApplyWrites,
  ComAtprotoRepoStrongRef,
} from "@atproto/api";
import { TID } from "@atproto/common-web";

import * as dcbor from "@ipld/dag-cbor";

import { CID } from "multiformats/cid";
import * as Hasher from "multiformats/hashes/hasher";

const mf_sha256 = Hasher.from({
  name: "sha2-256",
  code: 0x12,
  encode: async (input) => {
    const digest = await crypto.subtle.digest("sha-256", input);
    return new Uint8Array(digest);
  },
});

interface Post {
  text: string;
  facets?: AppBskyRichtextFacet.Main[];
  embed?:
    | (AppBskyEmbedImages.Main & { $type: "app.bsky.embed.images" })
    | (AppBskyEmbedExternal.Main & { $type: "app.bsky.embed.external" })
    | (AppBskyEmbedRecord.Main & { $type: "app.bsky.embed.record" })
    | (AppBskyEmbedRecordWithMedia.Main & {
        $type: "app.bsky.embed.recordWithMedia";
      });
  langs?: string[];
  labels?: ComAtprotoLabelDefs.SelfLabels;
  tags?: string[];
}

const did = `did:plc:ia76kvnndjutgedggx2ibrem`;

const now = new Date();
const writes: ComAtprotoRepoApplyWrites.Create[] = [];

// Example blob, you'll get this from uploadBlob but for the sake of this demo,
// I'll use a blob that's been uploaded to my account.
const blob = new BlobRef(
  CID.parse("bafkreier5qavjovxx3er6af2gzjpvam4agjgteh4md4t7g3au3quzv643y"),
  "image/png",
  318572
);

const posts: Post[] = [
  {
    text: "Post 1",
  },
  {
    text: "Post 2",
    embed: {
      $type: "app.bsky.embed.images",
      images: [
        {
          // IMPORTANT: `ipld` returns the correct object that we want to use for
          // hashing, ignore the type error.
          image: blob.ipld() as any,
          alt: "",
        },
      ],
    },
  },
];

let reply: AppBskyFeedPost.ReplyRef | undefined;
let tid: TID | undefined;

for (let idx = 0, len = posts.length; idx < len; idx++) {
  // The sorting behavior for multiple posts sharing the same createdAt time is
  // undefined, so what we'll do here is increment the time by 1 for every post
  now.setMilliseconds(idx);

  // Get the record key for this post
  tid = TID.next(tid);

  const rkey = tid.toString();
  const post = posts[idx];

  const record: AppBskyFeedPost.Record = {
    // IMPORTANT: $type has to exist, CID is calculated with the `$type` field
    // present and will produce the wrong CID if you omit it.
    // `createRecord` and `applyWrites` currently lets you omit this and it'll add
    // it for you, but we want to avoid that here.
    $type: "app.bsky.feed.post",
    createdAt: now.toISOString(),
    ...post,
  };

  // dag-cbor/cborg DOES not like undefined values.
  if (reply) {
    record.reply = reply;
  }

  writes.push({
    collection: "app.bsky.feed.post",
    rkey: rkey,
    value: record,
  });

  // Retrieve the next reply ref
  if (idx !== len - 1) {
    const encoded = dcbor.encode(record);

    const digest = await mf_sha256.digest(encoded);
    const cid = CID.createV1(0x71, digest);

    const ref: ComAtprotoRepoStrongRef.Main = {
      cid: cid.toString(),
      uri: `at://${did}/app.bsky.feed.post/${rkey}`,
    };

    reply = {
      root: reply ? reply.root : ref,
      parent: ref,
    };
  }
}

console.dir(writes, { depth: Infinity });
