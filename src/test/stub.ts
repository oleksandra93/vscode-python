// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { assert } from 'chai';

/**
 * StubCall records the name of a called function and the passed args.
 */
export class StubCall {
    constructor(
        // Funcname is the name of the function that was called.
        public readonly funcName: string,
        // Args is the set of arguments passed to the function. They are
        // in the same order as the function's parameters.
        // tslint:disable-next-line:no-any
        public readonly args: any[]) {}
}

/**
 * Stub is used in testing to stand in for some other value, to record
 * all calls to stubbed methods/functions, and to allow users to set the
 * values that are returned from those calls. Stub is intended to be
 * an attribute of a class that will define the methods to track:
 *
 *    class stubConn {
 *        public returnResponse: string = [];
 *
 *        constructor(
 *            public stub: Stub = new Stub()) {};
 *
 *        public send(request: string): string {
 *            this.stub.addCall('send', request);
 *            this.stub.maybeErr();
 *            return this.returnResponse;
 *        }
 *    }
 *
 * As demonstrated in the example, by supporting a stub argument, a
 * single Stub may be shared between multiple stubs.  This allows you
 * to capture the calls of all stubs in absolute order.
 *
 * Exceptions are set through setErrors().  Set them to the errors (or
 * lack thereof, i.e. null) you want raised.  The
 * `maybeErr` method raises the set exceptions (if any) in sequence,
 * falling back to null when the sequence is exhausted.  Thus each
 * stubbed method should call `maybeErr` to get its exception.
 * `popNoError` is an alternative if the method should never throw.
 *
 * To validate calls made to the stub in a test call the CheckCalls (or
 * CheckCall) method:
 *
 *    stub.checkCalls([
 *        new StubCall('send', [
 *            expected
 *        ])
 *    ]);
 *
 *    s.stub.CheckCall(0, 'send', expected);
 *
 * Not only is Stub useful for building an interface implementation to
 * use in testing (e.g. a network API client), it is also useful in
 * regular function patching situations:
 *
 *    class MyStub {
 *        public stub: Stub;
 *
 *        public someFunc(arg: any) {
 *            this.stub.addCall('someFunc', arg)
 *            this.stub.maybeErr();
 *        }
 *    }
 *
 *    const s = new MyStub();
 *    mod.func = s.someFunc;  // monkey-patch
 *
 * This allows for easily monitoring the args passed to the patched
 * func, as well as controlling the return value from the func in a
 * clean manner (by simply setting the correct field on the stub).
 */
// Based on:  https://github.com/juju/testing/blob/master/stub.go
export class Stub {
    // calls is the list of calls that have been registered on the stub
    // (i.e. made on the stub's methods), in the order that they were
    // made.
    private _calls: StubCall[];
    // errors holds the list of exceptions to use for successive calls
    // to methods that throw one.  Each call pops the next error off the
    // list.  An empty list (the default) implies a nil error.  null may
    // be precede actual errors in the list, which means that the first
    // calls will succeed, followed by the failure.  All this is
    // facilitated through the maybeErr method.
    private _errors: (Error | null)[];

    constructor() {
        this._calls = [];
        this._errors = [];
    }

    public get calls(): StubCall[] {
        return this._calls.slice(0);  // a copy
    }

    public get errors(): (Error | null)[] {
        return this._errors.slice(0);  // a copy
    }

    //=======================
    // before execution:

    /*
     * setErrors sets the sequence of exceptions for the stub. Each call
     * to maybeErr (thus each stub method call) pops an error off the
     * front.  So frontloading null here will allow calls to pass,
     * followed by a failure.
     */
    public setErrors(...errors: (Error | null)[]) {
        this._errors = errors;
    }

    //=======================
    // during execution:

    // addCall records a stubbed function call for later inspection
    // using the checkCalls method.  All stubbed functions should call
    // addCall.
    // tslint:disable-next-line:no-any
    public addCall(name: string, ...args: any[]) {
        this._calls.push(new StubCall(name, args));
    }

    /*
     * ResetCalls erases the calls recorded by this Stub.
     */
    public resetCalls() {
        this._calls = [];
    }

    /*
     * maybeErr returns the error that should be returned on the nth
     * call to any method on the stub.  It should be called for the
     * error return in all stubbed methods.
     */
    public maybeErr() {
        if (this._errors.length === 0) {
            return;
        }
        const err = this._errors[0];
        this._errors.shift();
        if (err !== null) {
            throw err;
        }
    }

    /*
     * popNoErr pops off the next error without returning it.  If the
     * error is not null then popNoErr will fail.
     *
     * popNoErr is useful in stub methods that do not return an error.
     */
    public popNoErr() {
        if (this._errors.length === 0) {
            return;
        }
        const err = this._errors[0];
        this._errors.shift();
        if (err !== null) {
            assert.fail(null, err, 'the next err was unexpectedly not null');
        }
    }

    //=======================
    // after execution:

    /*
     * checkCalls verifies that the history of calls on the stub's
     * methods matches the expected calls.
     */
    public checkCalls(expected: StubCall[]) {
        assert.deepEqual(this._calls, expected);
    }

    // tslint:disable-next-line:no-suspicious-comment
    // TODO: Add checkCallsUnordered?
    // tslint:disable-next-line:no-suspicious-comment
    // TODO: Add checkCallsSubset?

    /*
     * checkCall checks the recorded call at the given index against the
     * provided values. i If the index is out of bounds then the check
     * fails.
     */
    // tslint:disable-next-line:no-any
    public checkCall(index: number, funcName: string, ...args: any[]) {
        assert.isBelow(index, this._calls.length);
        const expected = new StubCall(funcName, args);
        assert.deepEqual(this._calls[index], expected);
    }

    /*
     * checkCallNames verifies that the in-order list of called method
     * names matches the expected calls.
     */
    public checkCallNames(...expected: string[]) {
        const names: string[] = [];
        for (const call of this._calls) {
            names.push(call.funcName);
        }
        assert.deepEqual(names, expected);
    }

    // checkNoCalls verifies that none of the stub's methods have been
    // called.
    public checkNoCalls() {
        assert.equal(this._calls.length, 0);
    }

    // checkErrors verifies that the list of unused exceptions is empty.
    public checkErrors() {
        assert.equal(this._errors.length, 0);
    }
}
