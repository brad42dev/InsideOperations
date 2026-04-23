export async function openForensicsWithPoints(
  tagnames: string[],
  mode: "most-recent-alarms" | "points",
) {
  window.dispatchEvent(
    new CustomEvent("io-navigate:forensics", {
      detail: { tagnames, mode },
    }),
  );
}
