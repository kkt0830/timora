import test from 'node:test';
import assert from 'node:assert/strict';
import { detectRuntime } from '../src/services/runtime.ts';
import { dispatchNativeBack, registerBackHandler, installNativeBack } from '../src/services/native-back.ts';
test('runtime selects local adapters for native Android/Windows, never for mobile Web alone', () => {
  assert.equal(detectRuntime(true, 'Mozilla/5.0 (Linux; Android 16)'), 'android');
  assert.equal(detectRuntime(false, 'Mozilla/5.0 (Linux; Android 16)'), 'web');
  assert.equal(detectRuntime(true, 'Windows NT 10.0'), 'windows');
  assert.equal(detectRuntime(true, ''), 'native');
});
test('Back handles dialog then popover/drawer then routes, unregisters safely and yields root to OS', () => {
  const calls = [];
  const route = registerBackHandler(10, () => { calls.push('route'); return false; });
  const drawer = registerBackHandler(50, () => { calls.push('drawer'); return true; });
  const popover = registerBackHandler(75, () => { calls.push('popover'); return true; });
  const dialog = registerBackHandler(100, () => { calls.push('dialog'); return true; });
  try {
    assert.equal(dispatchNativeBack(), true); assert.deepEqual(calls, ['dialog']); dialog(); dialog();
    assert.equal(dispatchNativeBack(), true); assert.equal(calls.at(-1), 'popover'); popover();
    assert.equal(dispatchNativeBack(), true); assert.equal(calls.at(-1), 'drawer'); drawer();
    assert.equal(dispatchNativeBack(), false); assert.equal(calls.at(-1), 'route');
    const target = {}; const uninstall = installNativeBack(target);
    assert.equal(target.__TIMORA_BACK__(), false); uninstall(); assert.equal(target.__TIMORA_BACK__, undefined);
  } finally { dialog(); popover(); drawer(); route(); }
  assert.equal(dispatchNativeBack(), false);
});
