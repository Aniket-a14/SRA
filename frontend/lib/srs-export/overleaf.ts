/**
 * Opens a LaTeX document directly in Overleaf in a new tab via the official Overleaf API.
 * Uses the URL-encoded `encoded_snip` parameter as specified in https://www.overleaf.com/devs
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

    // Overleaf API requires `encoded_snip` containing the URI-encoded LaTeX source
    const snipInput = document.createElement("input");
    snipInput.type = "hidden";
    snipInput.name = "encoded_snip";
    snipInput.value = encodeURIComponent(texContent);
    form.appendChild(snipInput);

    // Optional filename descriptor for the root project document
    const nameInput = document.createElement("input");
    nameInput.type = "hidden";
    nameInput.name = "snip_name";
    nameInput.value = documentName.endsWith(".tex") ? documentName : `${documentName}.tex`;
    form.appendChild(nameInput);

    document.body.appendChild(form);
    form.submit();
    document.body.removeChild(form);
}
