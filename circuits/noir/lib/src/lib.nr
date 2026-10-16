mod poseidon_consts;
use poseidon_consts::{MDS, N_ROUNDS, RC, ROUNDS_F, ROUNDS_P, T};

fn exp5(x: Field) -> Field {
    let x2 = x * x;
    x * x2 * x2
}

/// Classic Poseidon permutation (CAP-0075 / circomlib reference), t=3, d=5.
pub fn permute(input: [Field; 3]) -> [Field; 3] {
    let mut state = input;
    let n = N_ROUNDS;
    for r in 0..n {
        for j in 0..T {
            state[j] = state[j] + RC[r][j];
        }
        let is_full = r < ROUNDS_F / 2 | r >= ROUNDS_F / 2 + ROUNDS_P;
        if is_full {
            for j in 0..T {
                state[j] = exp5(state[j]);
            }
        } else {
            state[0] = exp5(state[0]);
        }
        let mut mixed: [Field; 3] = [0; 3];
        for i in 0..T {
            let mut acc: Field = 0;
            for j in 0..T {
                acc = acc + MDS[i][j] * state[j];
            }
            mixed[i] = acc;
        }
        state = mixed;
    }
    state
}

pub fn hash2(a: Field, b: Field) -> Field {
    permute([0, a, b])[0]
}

pub fn hash1(x: Field) -> Field {
    permute([0, x, 0])[0]
}

#[test]
fn hash2_matches_circomlib() {
    // golden.hash2_1_2
    let y = hash2(1, 2);
    assert(
        y
            == 7853200120776062878684798364095072458815029376092732009249414926327459813530,
    );
}
