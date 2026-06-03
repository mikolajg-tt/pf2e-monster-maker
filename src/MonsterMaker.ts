import {actorFields, DefaultCreatureStatistics, Levels, Statistics, Skills, Options, RoadMaps} from "./Keys";
import {statisticValues, aliases} from "./Values";

const ApplicationV2 = (foundry as any).applications.api.ApplicationV2;
const HandlebarsApplicationMixin = (foundry as any).applications.api.HandlebarsApplicationMixin;

export class MonsterMaker extends HandlebarsApplicationMixin(ApplicationV2) {
    actor: any;
    data = DefaultCreatureStatistics;
    level = "-1";

    constructor(actor: any = null, options: any = {}) {
        super(options);
        this.actor = actor;
    }

    static DEFAULT_OPTIONS = {
        id: "monster-maker-{id}",
        tag: "form",
        classes: ["monster-maker", "standard-form"],
        window: {
            title: "PF2EMONSTERMAKER.title",
            icon: "fa-solid fa-book",
            resizable: true,
            minimizable: true
        },
        position: {
            width: 600,
            height: 833
        },
        form: {
            handler: MonsterMaker._onSubmit,
            submitOnChange: false,
            closeOnSubmit: true
        }
    };

    static PARTS = {
        form: {
            template: "modules/pf2e-monster-maker/dist/forms/monsterMakerForm.html",
            scrollable: [".monster-maker-body"]
        }
    };

    get title() {
        return "Monster Maker";
    }

    async _prepareContext(_options) {
        const skillsCategory = this.data.find((c: any) => c.name === 'PF2EMONSTERMAKER.skills');
        if (skillsCategory) {
            skillsCategory.statisticEntries = MonsterMaker._getSystemSkills();
        }
        return {
            CreatureStatistics: JSON.parse(JSON.stringify(this.data)),
            Levels: Levels,
            RoadMaps: RoadMaps,
            name: this.actor?.name ?? "Monster"
        };
    }

    static _getSystemSkills(): { name: string; label: string }[] {
        const pf2eSkills = (CONFIG as any)?.PF2E?.skills ?? {};
        const entries = Object.entries(pf2eSkills).map(([slug, info]: [string, any]) => {
            const labelKey = typeof info === 'string' ? info : info?.label;
            const localized = labelKey ? game["i18n"].localize(labelKey) : slug;
            return { name: slug, label: localized };
        });
        entries.sort((a, b) => a.label.localeCompare(b.label));
        return entries;
    }

    _onRender(_context, _options) {
        const element = this.element as HTMLElement;
        element.querySelectorAll<HTMLElement>(".monster-maker-category-header").forEach(header => {
            header.addEventListener("click", () => {
                header.closest(".monster-maker-category")?.classList.toggle("collapsed");
            });
        });
        requestAnimationFrame(() => this._applyHeaderContrast(element));

        const getSelect = (suffix: string) =>
            document.getElementById(`monsterMaker${suffix}`) as HTMLSelectElement | null;

        const setValue = (sel: HTMLSelectElement, value: string) => {
            sel.value = value;
            sel.dispatchEvent(new Event("change", {bubbles: true}));
        };

        const setDefaults = () => {
            for (const category of this.data) {
                for (const statistic of category.statisticEntries) {
                    const sel = getSelect(statistic.name);
                    if (sel) setValue(sel, statistic.defaultValue ?? category.defaultValue);
                }
            }
        };

        element.querySelectorAll<HTMLSelectElement>("select").forEach(MonsterMaker._wrapSelect);
        setDefaults();

        const levelSel = getSelect("Level");
        const actorLevel = this.actor?.system?.details?.level?.value;
        if (levelSel && actorLevel !== undefined && actorLevel !== null) {
            const levelStr = String(actorLevel);
            if (Array.from(levelSel.options).some(o => o.value === levelStr)) {
                setValue(levelSel, levelStr);
            }
        }

        const roadmapSel = getSelect("Roadmap");
        if (roadmapSel) {
            roadmapSel.addEventListener("change", () => {
                setDefaults();
                const roadmap = (RoadMaps as any)[roadmapSel.value];
                if (!roadmap) return;
                for (const [key, value] of Object.entries(roadmap)) {
                    const sel = getSelect(key);
                    if (sel) setValue(sel, value as string);
                }
            });
        }

        const areaDCSel = getSelect(Statistics.areaDC);
        const unlimitedGroup = getSelect(Statistics.unlimitedUseAreaDamage)?.closest(".form-group") as HTMLElement | null;
        const limitedGroup = getSelect(Statistics.limitedUseAreaDamage)?.closest(".form-group") as HTMLElement | null;
        const updateAreaDamageVisibility = () => {
            const show = !!areaDCSel?.value && areaDCSel.value !== Options.none;
            if (unlimitedGroup) unlimitedGroup.style.display = show ? "" : "none";
            if (limitedGroup) limitedGroup.style.display = show ? "" : "none";
        };
        areaDCSel?.addEventListener("change", updateAreaDamageVisibility);
        updateAreaDamageVisibility();

        const loreInput = element.querySelector<HTMLInputElement>("#monsterMakerLoreName");
        const loreAdd = element.querySelector<HTMLButtonElement>("#monsterMakerLoreAdd");
        const loreList = element.querySelector<HTMLDivElement>("#monsterMakerLoreList");

        const loreOptions = [Options.none, Options.terrible, Options.low, Options.moderate, Options.high, Options.extreme];

        const referenceSelect = element.querySelector<HTMLSelectElement>(
            '.form-group:not(.lore-row):not(.lore-add-row) > select'
        );
        const syncLoreWidths = () => {
            if (!referenceSelect) return;
            const w = referenceSelect.getBoundingClientRect().width;
            if (w <= 0) return;
            element.querySelectorAll<HTMLElement>('.lore-add-controls, .lore-row-controls').forEach(el => {
                el.style.flex = `0 0 ${w}px`;
            });
        };
        requestAnimationFrame(syncLoreWidths);
        if (referenceSelect) {
            new ResizeObserver(() => requestAnimationFrame(syncLoreWidths)).observe(referenceSelect);
        }

        const createLoreRow = (name: string, initial?: string) => {
            if (!loreList) return;
            const row = document.createElement("div");
            row.className = "form-group setting lore-row";

            const label = document.createElement("label");
            label.className = "monsterMakerFormText lore-row-label";
            label.textContent = name;

            const controls = document.createElement("div");
            controls.className = "form-fields lore-row-controls";

            const select = document.createElement("select");
            select.className = "monsterMakerFormTextSmall lore-select";
            for (const opt of loreOptions) {
                const o = document.createElement("option");
                o.value = opt;
                o.textContent = game["i18n"].localize(opt);
                select.appendChild(o);
            }
            if (initial && loreOptions.includes(initial as Options)) {
                select.value = initial;
            }

            const remove = document.createElement("button");
            remove.type = "button";
            remove.className = "lore-remove";
            remove.title = "Remove";
            remove.innerHTML = '<i class="fa-solid fa-times"></i>';
            remove.addEventListener("click", () => row.remove());

            controls.appendChild(select);
            controls.appendChild(remove);
            row.appendChild(label);
            row.appendChild(controls);
            loreList.appendChild(row);

            MonsterMaker._wrapSelect(select);
            requestAnimationFrame(syncLoreWidths);
        };

        const addLore = () => {
            if (!loreInput) return;
            const raw = loreInput.value.trim();
            if (!raw) return;
            const lastWord = raw.split(/\s+/).pop() ?? "";
            const name = lastWord.toLowerCase() === "lore" ? raw : `${raw} Lore`;
            loreInput.value = "";
            createLoreRow(name);
        };

        loreAdd?.addEventListener("click", addLore);
        loreInput?.addEventListener("keydown", e => {
            if (e.key === "Enter") {
                e.preventDefault();
                addLore();
            }
        });

        if (this.actor) {
            this._prefillFromActor(getSelect, setValue, createLoreRow, levelSel?.value ?? "-1");
            updateAreaDamageVisibility();
        }
    }

    static _parseFormulaAverage(formula: string): number {
        if (!formula) return 0;
        let total = 0;
        const re = /([+-]?\s*\d+)\s*(?:d\s*(\d+))?/gi;
        let match: RegExpExecArray | null;
        while ((match = re.exec(formula)) !== null) {
            const numStr = match[1].replace(/\s+/g, "");
            const num = parseInt(numStr);
            if (Number.isNaN(num)) continue;
            const sides = match[2] ? parseInt(match[2]) : undefined;
            total += sides !== undefined ? num * (sides + 1) / 2 : num;
        }
        return total;
    }

    static _findClosest(actual: number, table: Record<string, any>, normalize?: (v: any) => number): string | null {
        let bestOption: string | null = null;
        let bestDiff = Infinity;
        for (const [opt, val] of Object.entries(table)) {
            const num = normalize ? normalize(val) : (typeof val === "string" ? parseFloat(val) : val);
            if (typeof num !== "number" || Number.isNaN(num)) continue;
            const diff = Math.abs(num - actual);
            if (diff < bestDiff) {
                bestDiff = diff;
                bestOption = opt;
            }
        }
        return bestOption;
    }

    _prefillFromActor(
        getSelect: (suffix: string) => HTMLSelectElement | null,
        setValue: (sel: HTMLSelectElement, value: string) => void,
        createLoreRow: (name: string, initial?: string) => void,
        level: string,
    ) {
        const actor = this.actor;
        const valueAt = (path: string) =>
            path.split(".").reduce((o: any, k: string) => o?.[k], actor);

        const trySet = (statKey: string, actual: number, table?: Record<string, any>, normalize?: (v: any) => number) => {
            if (typeof actual !== "number" || Number.isNaN(actual)) return;
            const sel = getSelect(statKey);
            if (!sel || !table) return;
            const validOptions = new Set(Array.from(sel.options).map(o => o.value));
            const filtered: Record<string, any> = {};
            for (const [k, v] of Object.entries(table)) {
                if (validOptions.has(k)) filtered[k] = v;
            }
            const opt = MonsterMaker._findClosest(actual, filtered, normalize);
            if (opt) setValue(sel, opt);
        };

        for (const [statKey, path] of Object.entries(actorFields)) {
            const actual = valueAt(path as string);
            if (typeof actual !== "number") continue;
            const table = (statisticValues as any)[statKey]?.[level];
            trySet(statKey, actual, table);
        }

        const strike = actor.items?.find?.((i: any) => i.type === "melee" || i.type === "ranged");
        if (strike) {
            const bonus = strike.system?.bonus?.value;
            if (typeof bonus === "number") {
                trySet(Statistics.strikeBonus, bonus, (aliases as any).strikeBonus?.[level]);
            }
            const rolls = strike.system?.damageRolls ?? {};
            let totalDamage = 0;
            for (const roll of Object.values(rolls)) {
                totalDamage += MonsterMaker._parseFormulaAverage((roll as any)?.damage ?? "");
            }
            if (totalDamage > 0) {
                trySet(
                    Statistics.strikeDamage,
                    totalDamage,
                    (aliases as any).strikeDamage?.[level],
                    (v: any) => MonsterMaker._parseFormulaAverage(String(v)),
                );
            }
        }

        const spellEntries = actor.items?.filter?.((i: any) => i.type === "spellcastingEntry") ?? [];
        let highestAttack = -Infinity;
        for (const e of spellEntries) {
            const att = e.system?.spelldc?.value;
            if (typeof att === "number" && att > highestAttack) highestAttack = att;
        }
        if (highestAttack > -Infinity) {
            trySet(Statistics.spellcasting, highestAttack, (aliases as any).spellcasting?.[level]);
        }

        const PREDEFINED_NAMES = { unlimited: "Unlimited Use Area Damage", limited: "Limited Use Area Damage" };
        const isAreaAbility = (item: any) => {
            if (item.type !== "action") return false;
            if (item.name === PREDEFINED_NAMES.unlimited || item.name === PREDEFINED_NAMES.limited) return true;
            const desc = item.system?.description?.value ?? "";
            return /@Damage/.test(desc) && /@Template/.test(desc) && /dc:\s*\d+/i.test(desc);
        };
        const looksLimited = (item: any) => {
            const desc = item.system?.description?.value ?? "";
            return /\/gmr\b|Recharge/i.test(desc);
        };
        const areaCandidates = actor.items?.filter?.(isAreaAbility) ?? [];
        let unlimitedItem: any = null;
        let limitedItem: any = null;
        for (const item of areaCandidates) {
            if (item.name === PREDEFINED_NAMES.unlimited) { unlimitedItem ??= item; continue; }
            if (item.name === PREDEFINED_NAMES.limited) { limitedItem ??= item; continue; }
            if (looksLimited(item)) limitedItem ??= item;
            else unlimitedItem ??= item;
        }
        const areaSource = unlimitedItem ?? limitedItem;
        if (areaSource) {
            const desc = areaSource.system?.description?.value ?? "";
            const m = desc.match(/dc:\s*(\d+)/i);
            if (m) {
                const dc = parseInt(m[1]);
                if (!Number.isNaN(dc)) {
                    trySet(Statistics.areaDC, dc - 8, (aliases as any).spellcasting?.[level]);
                }
            }
            if (unlimitedItem) {
                const sel = getSelect(Statistics.unlimitedUseAreaDamage);
                if (sel) setValue(sel, Options.yes);
            }
            if (limitedItem) {
                const sel = getSelect(Statistics.limitedUseAreaDamage);
                if (sel) setValue(sel, Options.yes);
            }
        }

        const skillsTable = (aliases as any).skills?.[level];
        const pf2eSkills = (CONFIG as any)?.PF2E?.skills ?? {};
        const sourceSkills = (actor._source?.system?.skills as any) ?? (actor.toObject?.()?.system?.skills as any) ?? {};
        for (const slug of Object.keys(pf2eSkills)) {
            const sel = getSelect(slug);
            if (!sel) continue;
            const base = sourceSkills[slug]?.base;
            if (typeof base === "number" && skillsTable) {
                trySet(slug, base, skillsTable);
            } else {
                setValue(sel, Options.none);
            }
        }

        const loreItems = actor.items?.filter?.((i: any) => i.type === "lore") ?? [];
        for (const lore of loreItems) {
            const mod = lore.system?.mod?.value;
            let initial: string = Options.none;
            if (typeof mod === "number" && skillsTable) {
                initial = MonsterMaker._findClosest(mod, skillsTable) ?? Options.none;
            }
            createLoreRow(lore.name, initial);
        }
    }

    _onClose(_options) {
        document.querySelectorAll(".mm-dropdown-popup").forEach(p => p.remove());
        return super["_onClose"]?.(_options);
    }

    _applyHeaderContrast(element: HTMLElement) {
        const parseRgb = (value: string): number[] | null => {
            const m = value.match(/rgba?\(([^)]+)\)/i);
            if (!m) return null;
            const p = m[1].split(/[,\s/]+/).map(parseFloat).filter(n => !Number.isNaN(n));
            return p.length >= 3 ? p : null;
        };
        const relLum = (rgb: number[]): number => {
            const a = rgb.slice(0, 3).map(v => {
                const c = v / 255;
                return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
            });
            return 0.2126 * a[0] + 0.7152 * a[1] + 0.0722 * a[2];
        };
        const contrast = (a: number[], b: number[]): number => {
            const hi = Math.max(relLum(a), relLum(b));
            const lo = Math.min(relLum(a), relLum(b));
            return (hi + 0.05) / (lo + 0.05);
        };

        const modal = element.closest<HTMLElement>(".application");
        const resolveBg = (start: HTMLElement): number[] => {
            let el: HTMLElement | null = start;
            while (el) {
                const rgb = parseRgb(getComputedStyle(el).backgroundColor);
                if (rgb && (rgb[3] === undefined || rgb[3] >= 0.5)) return rgb.slice(0, 3);
                if (el === modal) break;
                el = el.parentElement;
            }
            const themed = start.closest(".theme-dark, .theme-light") ?? document.body;
            if (themed.classList.contains("theme-dark")) return [30, 33, 40];
            if (themed.classList.contains("theme-light")) return [235, 226, 207];
            const t = parseRgb(getComputedStyle(modal ?? start).color) ?? [0, 0, 0];
            const textIsLight = (0.299 * t[0] + 0.587 * t[1] + 0.114 * t[2]) / 255 > 0.5;
            return textIsLight ? [30, 33, 40] : [235, 226, 207];
        };

        const TARGET = 4.5;
        element.querySelectorAll<HTMLElement>(".monster-maker-category-header").forEach(header => {
            header.style.removeProperty("color");
            const fg = parseRgb(getComputedStyle(header).color);
            if (!fg) return;
            const bg = resolveBg(header);
            if (contrast(fg, bg) >= TARGET) return;
            const towards = relLum(bg) > 0.5 ? [0, 0, 0] : [255, 255, 255];
            let chosen = towards;
            for (let t = 0.15; t < 1; t += 0.15) {
                const mixed = fg.slice(0, 3).map((c, i) => Math.round(c + (towards[i] - c) * t));
                if (contrast(mixed, bg) >= TARGET) { chosen = mixed; break; }
            }
            header.style.color = `rgb(${chosen[0]}, ${chosen[1]}, ${chosen[2]})`;
        });
    }

    static _wrapSelect(select: HTMLSelectElement) {
        select.classList.add("mm-dropdown-trigger");
        select.setAttribute("aria-haspopup", "listbox");
        select.setAttribute("aria-expanded", "false");

        const popup = document.createElement("ul");
        popup.className = "mm-dropdown-popup";
        popup.setAttribute("role", "listbox");
        if (select.id) popup.dataset.for = select.id;

        const buildOptions = () => {
            popup.innerHTML = "";
            for (const opt of Array.from(select.options)) {
                const li = document.createElement("li");
                li.className = "mm-dropdown-option";
                li.textContent = opt.textContent?.trim() ?? opt.value;
                li.setAttribute("role", "option");
                if (opt.value === select.value) {
                    li.classList.add("selected");
                    li.setAttribute("aria-selected", "true");
                }
                li.addEventListener("mousedown", e => e.preventDefault());
                li.addEventListener("click", e => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (select.value !== opt.value) {
                        select.value = opt.value;
                        select.dispatchEvent(new Event("change", {bubbles: true}));
                    }
                    close();
                });
                popup.appendChild(li);
            }
        };

        let isOpen = false;
        let rafId = 0;
        let outsideHandler: ((e: Event) => void) | null = null;
        let keyHandler: ((e: KeyboardEvent) => void) | null = null;
        let originLeft = 0;
        let originTop = 0;

        const parseRgb = (value: string): number[] | null => {
            const match = value.match(/rgba?\(([^)]+)\)/i);
            if (!match) return null;
            const parts = match[1].split(/[,\s/]+/).map(parseFloat).filter(n => !Number.isNaN(n));
            return parts.length >= 3 ? parts : null;
        };

        const applyColors = () => {
            const modal = select.closest<HTMLElement>(".application");
            const textHost = modal?.querySelector<HTMLElement>(".window-content") ?? modal ?? select;
            const textColor = getComputedStyle(textHost).color;
            popup.style.color = textColor;

            let baseRgb: number[] | null = null;
            let el: HTMLElement | null = modal;
            while (el && el !== document.body && el !== document.documentElement) {
                const rgb = parseRgb(getComputedStyle(el).backgroundColor);
                if (rgb && (rgb[3] === undefined || rgb[3] >= 0.5)) { baseRgb = rgb; break; }
                el = el.parentElement;
            }

            if (!baseRgb) {
                const t = parseRgb(textColor) ?? [0, 0, 0];
                const textIsLight = (0.299 * t[0] + 0.587 * t[1] + 0.114 * t[2]) / 255 > 0.5;
                baseRgb = textIsLight ? [38, 42, 50] : [233, 224, 205];
            }

            const f = 0.9;
            popup.style.background =
                `rgb(${Math.round(baseRgb[0] * f)}, ${Math.round(baseRgb[1] * f)}, ${Math.round(baseRgb[2] * f)})`;
        };

        const reposition = () => {
            const rect = select.getBoundingClientRect();
            popup.style.left = `${rect.left - originLeft}px`;
            popup.style.minWidth = `${rect.width}px`;
            const popupHeight = popup.offsetHeight;
            const spaceBelow = window.innerHeight - rect.bottom;
            if (spaceBelow < popupHeight && rect.top > popupHeight) {
                popup.style.top = `${rect.top - popupHeight - originTop}px`;
            } else {
                popup.style.top = `${rect.bottom - originTop}px`;
            }
        };

        const tick = () => {
            if (!isOpen) return;
            reposition();
            rafId = requestAnimationFrame(tick);
        };

        const open = () => {
            if (isOpen) return;
            buildOptions();
            const host = select.closest(".application") ?? document.body;
            host.appendChild(popup);
            applyColors();
            popup.style.left = "0px";
            popup.style.top = "0px";
            const probe = popup.getBoundingClientRect();
            originLeft = probe.left;
            originTop = probe.top;
            isOpen = true;
            select.setAttribute("aria-expanded", "true");
            reposition();
            rafId = requestAnimationFrame(tick);

            outsideHandler = (e: Event) => {
                const target = e.target as Node;
                if (popup.contains(target) || select.contains(target) || target === select) return;
                close();
            };
            keyHandler = (e: KeyboardEvent) => {
                if (e.key === "Escape") {
                    e.preventDefault();
                    close();
                    select.focus();
                }
            };
            document.addEventListener("mousedown", outsideHandler, true);
            document.addEventListener("keydown", keyHandler);
        };

        const close = () => {
            if (!isOpen) return;
            isOpen = false;
            cancelAnimationFrame(rafId);
            popup.remove();
            select.setAttribute("aria-expanded", "false");
            if (outsideHandler) document.removeEventListener("mousedown", outsideHandler, true);
            if (keyHandler) document.removeEventListener("keydown", keyHandler);
            outsideHandler = null;
            keyHandler = null;
        };

        select.addEventListener("mousedown", e => {
            e.preventDefault();
            if (isOpen) close(); else open();
        });

        select.addEventListener("keydown", e => {
            if (e.key === "Enter" || e.key === " " || e.key === "ArrowDown" || e.key === "ArrowUp") {
                e.preventDefault();
                if (!isOpen) open();
            }
        });
    }

    static async _onSubmit(this: MonsterMaker, _event, _form, formData) {
        const data = formData.object;
        this.level = data[Statistics.level];

        if (!this.actor) {
            const name = data[Statistics.name] || "Monster";
            this.actor = await (Actor as any).create({name, type: "npc"});
            if (!this.actor) return;
        }

        const updateData: any = {};
        for (const key of Object.keys(data)) {
            if (actorFields[key]) {
                const actorField = actorFields[key];
                const option = data[key];
                updateData[actorField] = parseInt(statisticValues[key][this.level][option]);
            }
        }
        Object.assign(updateData, this.applyName(data));
        Object.assign(updateData, this.applyLevel());
        await this.actor.update(updateData);
        await this.actor.update(this.applyHitPoints(data));
        await this.applyStrike(data);
        await this.applySpellcasting(data);
        await this.applyAreaDamage(data);
        await this.applySkills(data);
        await this.applyLore();
    }

    async applyAreaDamage(formData) {
        const dcOption = formData[Statistics.areaDC];
        if (!dcOption || dcOption === Options.none) return;
        const dcRaw = (aliases as any).spellcasting?.[this.level]?.[dcOption];
        if (dcRaw === undefined) return;
        const attackBonus = parseInt(dcRaw);
        if (Number.isNaN(attackBonus)) return;
        const dc = attackBonus + 8;
        const damages = (aliases as any).areaDamage?.[this.level];
        if (!damages) return;

        const monsterName = this.actor?.name ?? "Monster";
        const items: any[] = [];

        if (formData[Statistics.unlimitedUseAreaDamage] === Options.yes) {
            const description =
                `<p>The ${monsterName} deals @Damage[${damages.unlimited}] damage in an area ` +
                `(@Check[reflex|dc:${dc}|basic|options:area-effect] save).</p>`;
            items.push({
                name: "Unlimited Use Area Damage",
                type: "action",
                system: {
                    actionType: { value: "action" },
                    actions: { value: 2 },
                    description: { value: description },
                },
            });
        }

        if (formData[Statistics.limitedUseAreaDamage] === Options.yes) {
            const description =
                `<p>The ${monsterName} deals @Damage[${damages.limited}] damage in an area ` +
                `(@Check[reflex|dc:${dc}|basic|options:area-effect] save).</p>` +
                `<p>The ${monsterName} can't use Limited Use Area Damage again for ` +
                `[[/gmr 1d4 #Recharge Limited Use Area Damage]]{1d4 rounds}.</p>`;
            items.push({
                name: "Limited Use Area Damage",
                type: "action",
                system: {
                    actionType: { value: "action" },
                    actions: { value: 2 },
                    description: { value: description },
                },
            });
        }

        await this._replaceItems(items);
    }

    async applyLore() {
        const valueTable = (aliases as any).skills?.[this.level];
        if (!valueTable) return;
        const rows = (this.element as HTMLElement).querySelectorAll<HTMLDivElement>(".lore-row");
        const items: any[] = [];
        for (const row of Array.from(rows)) {
            const labelEl = row.querySelector<HTMLLabelElement>(".lore-row-label");
            const select = row.querySelector<HTMLSelectElement>(".lore-select");
            const name = labelEl?.textContent?.trim();
            if (!name || !select) continue;
            const option = select.value;
            if (!option || option === Options.none) continue;
            const raw = valueTable[option];
            if (raw === undefined) continue;
            const value = parseInt(raw);
            if (Number.isNaN(value)) continue;
            items.push({
                name,
                type: "lore",
                system: { mod: { value } }
            });
        }
        await this._replaceItems(items);
    }

    applyName(formData) {
        const name = formData[Statistics.name] ? formData[Statistics.name] : (this.actor?.name ?? "Monster");
        return {"name": name, "prototypeToken.name": name};
    }

    applyLevel() {
        return {"system.details.level.value": parseInt(this.level)};
    }

    applyHitPoints(formData) {
        const option = formData[Statistics.hp];
        const hitPoints = parseInt(statisticValues[Statistics.hp][this.level][option]);
        return {"system.attributes.hp.value": hitPoints};
    }

    async applyStrike(formData) {
        const strikeBonusOption = formData[Statistics.strikeBonus];
        const strikeDamageOption = formData[Statistics.strikeDamage];
        const strikeBonus = parseInt(statisticValues[Statistics.strikeBonus][this.level][strikeBonusOption]);
        const strikeDamage = statisticValues[Statistics.strikeDamage][this.level][strikeDamageOption];
        const strikeDamageID = foundry.utils.randomID();
        const strike = {
            name: game["i18n"].localize("PF2EMONSTERMAKER.strike"),
            type: 'melee',
            system: {
                damageRolls: {
                    strikeDamageID: {
                        damage: strikeDamage,
                        damageType: 'bludgeoning',
                        category: null
                    },
                },
                bonus: {
                    value: strikeBonus,
                },
            },
        };
        await this._replaceItems([strike]);
    }

    async _replaceItems(items: any[]) {
        if (!items.length) return;
        const existingIds = this.actor.items
            .filter((i: any) => items.some(n => n.name === i.name && n.type === i.type))
            .map((i: any) => i.id);
        if (existingIds.length > 0) {
            await this.actor.deleteEmbeddedDocuments("Item", existingIds);
        }
        await (Item as any).createDocuments(items, { parent: this.actor });
    }

    applySpellcasting(formData) {
        const spellcastingOption = formData[Statistics.spellcasting];
        if (spellcastingOption === Options.none) return;
        const spellcastingBonus = parseInt(statisticValues[Statistics.spellcasting][this.level][spellcastingOption]);
        const spellcasting = {
            name: game["i18n"].localize("PF2EMONSTERMAKER.spellcasting"),
            type: "spellcastingEntry",
            system: {
                spelldc: {
                    value: spellcastingBonus,
                    dc: spellcastingBonus + 8,
                },
                tradition: {value: 'arcane'},
                prepared: {value: 'innate'},
                showUnpreparedSpells: {value: true},
            }
        };
        return Item.create(spellcasting, {parent: this.actor});
    }

    async applySkills(formData) {
        const valueTable = (aliases as any).skills?.[this.level];
        if (!valueTable) return;
        const pf2eSkills = (CONFIG as any)?.PF2E?.skills ?? {};
        const updateData: any = {};
        for (const slug of Object.keys(pf2eSkills)) {
            const option = formData[slug];
            if (!option || option === Options.none) continue;
            const raw = valueTable[option];
            if (raw === undefined) continue;
            const value = parseInt(raw);
            if (Number.isNaN(value)) continue;
            updateData[`system.skills.${slug}.base`] = value;
        }
        if (Object.keys(updateData).length > 0) {
            await this.actor.update(updateData);
        }
    }
}
