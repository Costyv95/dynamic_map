// Tests run as an HA page with a session: data-dir reads go through the
// (usually mocked) global fetch, and pictures become numbered blob URLs.
import { setDataFetch } from '../shared/DataUrl.js?v=3.2.1';

setDataFetch((url, init) => globalThis.fetch(url, init));
let blobs = 0;
if (!URL.createObjectURL) URL.createObjectURL = () => `blob:test/${++blobs}`;
if (!URL.revokeObjectURL) URL.revokeObjectURL = () => {};
