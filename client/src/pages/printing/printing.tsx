import { CSSProperties, ReactElement, ReactNode } from "react";
import { v4 as uuidv4 } from "uuid";
import { useGetSetting, useSetSetting } from "../../utils/querySettings";
import { ISpool } from "../spools/model";

export interface PrintSettings {
  id: string;
  name?: string;
  margin?: { top: number; bottom: number; left: number; right: number };
  printerMargin?: { top: number; bottom: number; left: number; right: number };
  spacing?: { horizontal: number; vertical: number };
  columns?: number;
  rows?: number;
  skipItems?: number;
  itemCopies?: number;
  paperSize?: string;
  customPaperSize?: { width: number; height: number };
  borderShowMode?: "none" | "border" | "grid";
}

export interface QRCodePrintSettings {
  showContent?: boolean;
  showQRCodeMode?: "no" | "simple" | "withIcon";
  textSize?: number;
  printSettings: PrintSettings;
}

export interface SpoolQRCodePrintSettings {
  template?: string;
  labelSettings: QRCodePrintSettings;
}

export function useGetPrintSettings(): SpoolQRCodePrintSettings[] | undefined {
  const { data } = useGetSetting("print_presets");
  if (!data) return;
  const parsed: SpoolQRCodePrintSettings[] =
    data && data.value ? JSON.parse(data.value) : ([] as SpoolQRCodePrintSettings[]);
  // Loop through all parsed and generate a new ID field if it's not set
  return parsed.map((settings) => {
    if (!settings.labelSettings.printSettings.id) {
      settings.labelSettings.printSettings.id = uuidv4();
    }
    return settings;
  });
}

export function useSetPrintSettings(): (spoolQRCodePrintSettings: SpoolQRCodePrintSettings[]) => void {
  const mut = useSetSetting("print_presets");

  return (spoolQRCodePrintSettings: SpoolQRCodePrintSettings[]) => {
    mut.mutate(spoolQRCodePrintSettings);
  };
}

interface GenericObject {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
  extra: { [key: string]: string };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getTagValue(tag: string, obj: GenericObject): any {
  // Split tag by .
  const tagParts = tag.split(".");
  if (tagParts[0] === "extra") {
    const extraValue = obj.extra[tagParts[1]];
    if (extraValue === undefined) {
      return "?";
    }
    return JSON.parse(extraValue);
  }

  const value = obj[tagParts[0]] ?? "?";
  // check if value is itself an object. If so, recursively call this and remove the first part of the tag
  if (typeof value === "object") {
    return getTagValue(tagParts.slice(1).join("."), value);
  }
  return value;
}

const COLOR_SWATCH_TAG = "filament.color_swatch";

function normalizeHexColor(hex: unknown): string | undefined {
  const normalized = String(hex ?? "")
    .trim()
    .replace(/^#/, "");

  if (!/^[0-9a-fA-F]{6}([0-9a-fA-F]{2})?$/.test(normalized)) {
    return undefined;
  }

  return `#${normalized.slice(0, 6)}`;
}

function splitHexColors(hexes: unknown): string[] {
  return String(hexes ?? "")
    .split(",")
    .map(normalizeHexColor)
    .filter((color): color is string => Boolean(color));
}

export function getColorSwatchBackground(spool: ISpool): string | undefined {
  const multiColors = splitHexColors(spool.filament.multi_color_hexes);

  if (multiColors.length > 1) {
    const direction = spool.filament.multi_color_direction?.toLowerCase();

    if (direction === "coaxial" || direction === "radial") {
      const step = 360 / multiColors.length;

      return `conic-gradient(${multiColors
        .map((color, index) => `${color} ${index * step}deg ${(index + 1) * step}deg`)
        .join(", ")})`;
    }

    const step = 100 / multiColors.length;

    return `linear-gradient(90deg, ${multiColors
      .map((color, index) => `${color} ${index * step}% ${(index + 1) * step}%`)
      .join(", ")})`;
  }

  return multiColors[0] ?? normalizeHexColor(spool.filament.color_hex);
}

function renderColorSwatch(spool: ISpool, key: string): ReactElement | null {
  const background = getColorSwatchBackground(spool);

  if (!background) {
    return null;
  }

  const style: CSSProperties = {
    display: "inline-block",
    width: "5mm",
    height: "5mm",
    minWidth: "5mm",
    border: "0.25mm solid #000",
    borderRadius: "0.75mm",
    background,
    verticalAlign: "-0.8mm",
    marginRight: "1mm",
    WebkitPrintColorAdjust: "exact",
    printColorAdjust: "exact",
  };

  return <span key={key} style={style} title={background} />;
}

function renderFormattedText(text: string, keyPrefix: string): ReactElement[] {
  const regex = /\*\*([\w\W]*?)\*\*/g;
  const parts = text.split(regex);

  return parts.map((part, index) => {
    const children: ReactNode[] = [];

    part.split("\n").forEach((line, lineIndex, arr) => {
      children.push(line);

      if (lineIndex < arr.length - 1) {
        children.push(<br key={`${keyPrefix}-${index}-${lineIndex}-br`} />);
      }
    });

    return index % 2 === 0 ? (
      <span key={`${keyPrefix}-${index}`}>{children}</span>
    ) : (
      <b key={`${keyPrefix}-${index}`}>{children}</b>
    );
  });
}

export function renderLabelContents(template: string, spool: ISpool): ReactElement {
  const matches = [...template.matchAll(/{(?:[^}{]|{[^}{]*})*}/gs)];
  const elements: ReactNode[] = [];
  let lastIndex = 0;
  let keyCounter = 0;

  const pushText = (text: string) => {
    if (text.length === 0) return;
    elements.push(...renderFormattedText(text, `text-${keyCounter++}`));
  };

  const pushSwatch = () => {
    const swatch = renderColorSwatch(spool, `swatch-${keyCounter++}`);

    if (swatch) {
      elements.push(swatch);
    }

    return swatch;
  };

  const pushTag = (tag: string) => {
    if (tag === COLOR_SWATCH_TAG) {
      pushSwatch();
      return;
    }

    const tagValue = getTagValue(tag, spool);
    pushText(String(tagValue));
  };

  matches.forEach((match) => {
    const matchIndex = match.index ?? 0;
    const token = match[0];

    pushText(template.slice(lastIndex, matchIndex));

    const braceCount = token.match(/{/g)?.length ?? 0;

    if (braceCount === 1) {
      const tag = token.replace(/[{}]/g, "");
      pushTag(tag);
    } else if (braceCount === 2) {
      const structure = token.match(/{(.*?){(.*?)}(.*?)}/);

      if (structure !== null) {
        const prefix = structure[1];
        const tag = structure[2];
        const suffix = structure[3];

        if (tag === COLOR_SWATCH_TAG) {
          if (getColorSwatchBackground(spool)) {
            pushText(prefix);
            pushSwatch();
            pushText(suffix);
          }
        } else {
          const tagValue = getTagValue(tag, spool);

          if (tagValue !== "?") {
            pushText(`${prefix}${tagValue}${suffix}`);
          }
        }
      } else {
        pushText(token);
      }
    } else {
      pushText(token);
    }

    lastIndex = matchIndex + token.length;
  });

  pushText(template.slice(lastIndex));

  return <>{elements}</>;
}
