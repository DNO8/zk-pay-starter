/// Toy "I know x such that H(x) = y" with H(x) = x^2.
/// This is the GIVEN hello circuit: prove it, then verify on testnet.
fn main(x: Field, y: pub Field) {
    assert(x * x == y);
}

#[test]
fn hello_vector() {
    main(3, 9);
}
