import '@testing-library/jest-dom';

import { TextDecoder as NodeTextDecoder, TextEncoder as NodeTextEncoder } from 'util';

// Firebase (and some transitive deps) expect Web APIs to exist in JSDOM/Jest.
if (typeof global.TextEncoder === 'undefined') {
  // eslint-disable-next-line no-global-assign
  global.TextEncoder = NodeTextEncoder;
}
if (typeof global.TextDecoder === 'undefined') {
  // eslint-disable-next-line no-global-assign
  global.TextDecoder = NodeTextDecoder;
}

import reportWebVitals from './reportWebVitals';

export default reportWebVitals;
