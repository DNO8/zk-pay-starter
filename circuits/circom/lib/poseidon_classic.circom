pragma circom 2.1.9;

include "poseidon_consts.circom";

template Exp5() {
    signal input in;
    signal output out;
    signal x2 <== in * in;
    signal x4 <== x2 * x2;
    out <== in * x4;
}

/// Classic Poseidon permutation, t=3, d=5. Matches CAP-0075 and circomlib Poseidon(2).
template PoseidonPermute() {
    signal input inp[3];
    signal output out[3];

    var t = POSEIDON_T();
    var rf = POSEIDON_RF();
    var rp = POSEIDON_RP();
    var n = POSEIDON_NROUNDS();

    component sbox[n][3];
    signal state[n + 1][3];
    signal mixed[n][3];
    signal afterRc[n][3];

    for (var j = 0; j < t; j++) {
        state[0][j] <== inp[j];
    }

    for (var r = 0; r < n; r++) {
        var isFull = (r < rf / 2) || (r >= rf / 2 + rp);
        for (var j = 0; j < t; j++) {
            afterRc[r][j] <== state[r][j] + POSEIDON_RC(r, j);
        }
        if (isFull) {
            for (var j = 0; j < t; j++) {
                sbox[r][j] = Exp5();
                sbox[r][j].in <== afterRc[r][j];
            }
            for (var i = 0; i < t; i++) {
                mixed[r][i] <== sbox[r][0].out * POSEIDON_MDS(i, 0)
                    + sbox[r][1].out * POSEIDON_MDS(i, 1)
                    + sbox[r][2].out * POSEIDON_MDS(i, 2);
            }
        } else {
            sbox[r][0] = Exp5();
            sbox[r][0].in <== afterRc[r][0];
            // unused slots still need to exist because the array is static
            sbox[r][1] = Exp5();
            sbox[r][1].in <== 0;
            sbox[r][2] = Exp5();
            sbox[r][2].in <== 0;
            for (var i = 0; i < t; i++) {
                mixed[r][i] <== sbox[r][0].out * POSEIDON_MDS(i, 0)
                    + afterRc[r][1] * POSEIDON_MDS(i, 1)
                    + afterRc[r][2] * POSEIDON_MDS(i, 2);
            }
        }
        for (var j = 0; j < t; j++) {
            state[r + 1][j] <== mixed[r][j];
        }
    }

    for (var j = 0; j < t; j++) {
        out[j] <== state[n][j];
    }
}

template Hash2() {
    signal input a;
    signal input b;
    signal output out;
    component p = PoseidonPermute();
    p.inp[0] <== 0;
    p.inp[1] <== a;
    p.inp[2] <== b;
    out <== p.out[0];
}
