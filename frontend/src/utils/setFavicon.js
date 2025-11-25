export function setFavicon(iconPath) {
  let link =
    document.querySelector("link[rel~='icon']") ||
    document.createElement("link");

  link.rel = "icon";
  link.href = iconPath;

  document.getElementsByTagName("head")[0].appendChild(link);
}
