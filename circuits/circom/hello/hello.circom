pragma circom 2.1.9;

/// Toy "I know x such that H(x) = y" with H(x) = x².
/// GIVEN hello circuit for the Groth16 path.
template Hello() {
    signal input x;
    signal output y;
    y <== x * x;
}

component main = Hello();
