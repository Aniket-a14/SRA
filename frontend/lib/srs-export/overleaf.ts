/**
 * Opens a LaTeX document directly in Overleaf in a new tab via the Overleaf Snip API.
 * This spins up a full Overleaf workspace with the document pre-loaded without requiring any server setup.
 */
export function openInOverleaf(texContent: string, documentName = "main.tex"): void {
    if (typeof window === "undefined" || typeof document === "undefined") {
        return;
    }

    const form = document.createElement("form");
    form.method = "POST";
    form.action = "https://www.overleaf.com/docs";
    form.target = "_blank";
    form.rel = "noopener noreferrer";
    form.style.display = "none";

    const snipInput = document.createElement("input");
    snipInput.type = "hidden";
    snipInput.name = "snip";
    snipInput.value = texContent;
    form.appendChild(snipInput);

    const nameInput = document.createElement("input");
    nameInput.type = "hidden";
    nameInput.name = "snip_name";
    nameInput.value = documentName.endsWith(".tex") ? documentName : `${documentName}.tex`;
    form.appendChild(nameInput);

    document.body.appendChild(form);
    form.submit();
    document.body.removeChild(form);
}
