import { BlobRef } from "@atproto/api";

export const isPlainObject = (v: any): boolean => {
  if (typeof v !== "object" || v === null) {
    return false;
  }

  const proto = Object.getPrototypeOf(v);
  return proto === Object || proto === null;
};

export const prepareObject = (v: any): any => {
  // IMPORTANT: BlobRef#ipld() returns the correct object we need for hashing,
  // the API client will convert this for you but we're hashing in the client,
  // so we need it *now*.
  if (v instanceof BlobRef) {
    return v.ipld();
  }

  // Return as-is for anything that doesn't look like a plain object
  if (!isPlainObject(v)) {
    return v;
  }

  const obj: any = {};

  let pure = true;

  for (const key in v) {
    let value = v[key];

    // `value` is undefined
    if (value === undefined) {
      pure = false;
      continue;
    }

    // `prepareObject` returned a value that's different from what we had before
    if (value !== (value = prepareObject(value))) {
      pure = false;
    }

    obj[key] = value;
  }

  // Return as-is if the object is pure
  if (pure) {
    return v;
  }

  return obj;
};
