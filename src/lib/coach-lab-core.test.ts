import { describe, expect, it } from "vitest";

import { average, labStatus } from "@/lib/coach-lab-core";

describe("laboratoire des éducateurs", () => {
  it("statut calculé selon les essais", () => {
    expect(labStatus("a_tester", [])).toBe("a_tester");
    expect(labStatus("a_tester", [5])).toBe("en_test");
    expect(labStatus("en_test", [5, 4])).toBe("concluant");
    expect(labStatus("en_test", [2, 2, 3])).toBe("a_revoir");
    expect(labStatus("en_test", [3, 3])).toBe("en_test");
  });
  it("une décision de JP ne bouge plus", () => {
    expect(labStatus("dans_methode", [1, 1])).toBe("dans_methode");
    expect(labStatus("abandonne", [5, 5])).toBe("abandonne");
  });
  it("moyenne à une décimale", () => {
    expect(average([5, 4, 4])).toBe(4.3);
    expect(average([])).toBeNull();
  });
});
