pragma circom 2.1.9;

include "poseidon_classic.circom";

// GIVEN: compile-and-witness check that Hash2(1,2) matches packages/shared.
component main = Hash2();
