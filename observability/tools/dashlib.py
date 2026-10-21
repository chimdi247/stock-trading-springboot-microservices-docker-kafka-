"""Tiny helper library to generate Grafana dashboard JSON (schemaVersion 39)."""
import json

PROM = {"type": "prometheus", "uid": "prometheus"}
LOKI = {"type": "loki", "uid": "loki"}
TEMPO = {"type": "tempo", "uid": "tempo"}

GREEN, YELLOW, ORANGE, RED, BLUE, PURPLE = "green", "yellow", "orange", "red", "blue", "purple"


def _steps(th):
    """th = [(None,'green'),(80,'red')] -> Grafana threshold steps."""
    return [{"color": c, "value": v} for v, c in th]


def _targets(ts, ds=PROM, instant=False, fmt=None):
    out = []
    for i, t in enumerate(ts):
        expr, legend = (t, "") if isinstance(t, str) else t
        d = {"datasource": ds, "expr": expr, "legendFormat": legend,
             "refId": chr(65 + i), "editorMode": "code"}
        if instant:
            d.update({"instant": True, "range": False})
        else:
            d.update({"range": True, "instant": False})
        if fmt:
            d["format"] = fmt
        out.append(d)
    return out


class Dash:
    def __init__(self, uid, title, tags, desc="", refresh="10s", time_from="now-1h"):
        self.d = {
            "uid": uid, "title": title, "tags": tags, "description": desc,
            "editable": True, "graphTooltip": 1, "schemaVersion": 39, "version": 1,
            "refresh": refresh, "time": {"from": time_from, "to": "now"},
            "timepicker": {}, "timezone": "browser", "fiscalYearStartMonth": 0,
            "liveNow": False, "style": "dark",
            "annotations": {"list": [{
                "builtIn": 1, "datasource": {"type": "grafana", "uid": "-- Grafana --"},
                "enable": True, "hide": True, "iconColor": "rgba(0, 211, 255, 1)",
                "name": "Annotations & Alerts", "type": "dashboard"}]},
            "templating": {"list": []}, "panels": [], "links": [],
        }
        self._id = 1
        self._y = 0
        self._x = 0
        self._rowh = 0

    # ----- variables -----
    def var_query(self, name, query, label=None, multi=True, include_all=True, regex=""):
        self.d["templating"]["list"].append({
            "name": name, "label": label or name, "type": "query", "datasource": PROM,
            "query": {"query": query, "refId": "v", "qryType": 1},
            "definition": query, "refresh": 2, "sort": 1, "multi": multi,
            "includeAll": include_all, "allValue": ".+", "regex": regex,
            "current": {"selected": True, "text": ["All"], "value": ["$__all"]} if multi else {},
            "hide": 0, "skipUrlSync": False, "options": []})

    def var_const(self, name, value, label=None):
        self.d["templating"]["list"].append({
            "name": name, "label": label or name, "type": "constant", "query": str(value),
            "hide": 2, "current": {"text": str(value), "value": str(value)},
            "options": [{"selected": True, "text": str(value), "value": str(value)}]})

    def var_custom(self, name, values, label=None):
        self.d["templating"]["list"].append({
            "name": name, "label": label or name, "type": "custom",
            "query": ",".join(values), "multi": False, "includeAll": False,
            "current": {"text": values[0], "value": values[0]},
            "options": [{"selected": i == 0, "text": v, "value": v} for i, v in enumerate(values)],
            "hide": 0})

    # ----- layout -----
    def row(self, title, collapsed=False):
        self._y += self._rowh
        self._x, self._rowh = 0, 0
        self.d["panels"].append({
            "id": self._nid(), "type": "row", "title": title, "collapsed": collapsed,
            "gridPos": {"h": 1, "w": 24, "x": 0, "y": self._y}, "panels": []})
        self._y += 1

    def _nid(self):
        self._id += 1
        return self._id

    def _place(self, w, h):
        if self._x + w > 24:
            self._y += self._rowh
            self._x, self._rowh = 0, 0
        pos = {"h": h, "w": w, "x": self._x, "y": self._y}
        self._x += w
        self._rowh = max(self._rowh, h)
        return pos

    def _add(self, p, w, h):
        p["id"] = self._nid()
        p["gridPos"] = self._place(w, h)
        self.d["panels"].append(p)

    # ----- panels -----
    def timeseries(self, title, targets, w=8, h=8, unit="short", desc="", stack=False, fill=12,
                   th=None, th_mode="line", minv=None, maxv=None, legend="bottom",
                   decimals=None, ds=PROM, overrides=None, draw="line", legend_calcs=None):
        defaults = {
            "unit": unit,
            "custom": {"drawStyle": draw, "lineWidth": 1, "fillOpacity": fill, "showPoints": "never",
                       "spanNulls": True, "stacking": {"mode": "normal" if stack else "none", "group": "A"},
                       "thresholdsStyle": {"mode": th_mode if th else "off"}, "axisPlacement": "auto"},
            "color": {"mode": "palette-classic"},
            "thresholds": {"mode": "absolute", "steps": _steps(th or [(None, GREEN)])},
        }
        if minv is not None: defaults["min"] = minv
        if maxv is not None: defaults["max"] = maxv
        if decimals is not None: defaults["decimals"] = decimals
        p = {"type": "timeseries", "title": title, "description": desc, "datasource": ds,
             "targets": _targets(targets, ds),
             "fieldConfig": {"defaults": defaults, "overrides": overrides or []},
             "options": {"legend": {"displayMode": "table" if legend_calcs else "list",
                                    "placement": "right" if legend == "right" else "bottom",
                                    "showLegend": legend != "none",
                                    "calcs": legend_calcs or []},
                         "tooltip": {"mode": "multi", "sort": "desc"}}}
        self._add(p, w, h)

    def stat(self, title, targets, w=4, h=4, unit="short", desc="", th=None, mappings=None,
             color_mode="background", decimals=None, instant=True, graph=False, minv=None,
             maxv=None, text_mode="auto", reduce="lastNotNull", ds=PROM):
        defaults = {"unit": unit, "mappings": mappings or [],
                    "thresholds": {"mode": "absolute", "steps": _steps(th or [(None, GREEN)])},
                    "color": {"mode": "thresholds"}}
        if decimals is not None: defaults["decimals"] = decimals
        if minv is not None: defaults["min"] = minv
        if maxv is not None: defaults["max"] = maxv
        p = {"type": "stat", "title": title, "description": desc, "datasource": ds,
             "targets": _targets(targets, ds, instant=instant),
             "fieldConfig": {"defaults": defaults, "overrides": []},
             "options": {"colorMode": color_mode, "graphMode": "area" if graph else "none",
                         "justifyMode": "auto", "textMode": text_mode, "orientation": "auto",
                         "reduceOptions": {"calcs": [reduce], "fields": "", "values": False}}}
        self._add(p, w, h)

    def gauge(self, title, targets, w=4, h=5, unit="percent", desc="", th=None, minv=0, maxv=100):
        p = {"type": "gauge", "title": title, "description": desc, "datasource": PROM,
             "targets": _targets(targets, instant=True),
             "fieldConfig": {"defaults": {"unit": unit, "min": minv, "max": maxv,
                                          "thresholds": {"mode": "absolute", "steps": _steps(th or [(None, GREEN), (80, RED)])},
                                          "color": {"mode": "thresholds"}}, "overrides": []},
             "options": {"showThresholdLabels": False, "showThresholdMarkers": True,
                         "reduceOptions": {"calcs": ["lastNotNull"], "fields": "", "values": False}}}
        self._add(p, w, h)

    def bargauge(self, title, targets, w=8, h=8, unit="short", desc="", th=None, minv=0, maxv=None,
                 orientation="horizontal"):
        defaults = {"unit": unit, "min": minv,
                    "thresholds": {"mode": "absolute", "steps": _steps(th or [(None, GREEN)])},
                    "color": {"mode": "thresholds"}}
        if maxv is not None: defaults["max"] = maxv
        p = {"type": "bargauge", "title": title, "description": desc, "datasource": PROM,
             "targets": _targets(targets, instant=True),
             "fieldConfig": {"defaults": defaults, "overrides": []},
             "options": {"displayMode": "gradient", "orientation": orientation, "showUnfilled": True,
                         "reduceOptions": {"calcs": ["lastNotNull"], "fields": "", "values": False}}}
        self._add(p, w, h)

    def piechart(self, title, targets, w=6, h=8, unit="short", desc=""):
        p = {"type": "piechart", "title": title, "description": desc, "datasource": PROM,
             "targets": _targets(targets, instant=True),
             "fieldConfig": {"defaults": {"unit": unit, "color": {"mode": "palette-classic"}}, "overrides": []},
             "options": {"pieType": "donut", "legend": {"displayMode": "table", "placement": "right", "values": ["value"]},
                         "reduceOptions": {"calcs": ["lastNotNull"], "fields": "", "values": False},
                         "tooltip": {"mode": "single"}}}
        self._add(p, w, h)

    def table(self, title, targets, w=12, h=8, unit="short", desc="", transforms=None, overrides=None,
              sort_by=None):
        p = {"type": "table", "title": title, "description": desc, "datasource": PROM,
             "targets": _targets(targets, instant=True, fmt="table"),
             "fieldConfig": {"defaults": {"unit": unit, "custom": {"align": "auto", "cellOptions": {"type": "auto"}}},
                             "overrides": overrides or []},
             "options": {"showHeader": True, "cellHeight": "sm",
                         "sortBy": [{"displayName": sort_by, "desc": True}] if sort_by else []},
             "transformations": transforms or []}
        self._add(p, w, h)

    def logs(self, title, expr, w=24, h=10, desc=""):
        p = {"type": "logs", "title": title, "description": desc, "datasource": LOKI,
             "targets": [{"datasource": LOKI, "expr": expr, "refId": "A", "queryType": "range", "editorMode": "code"}],
             "options": {"showTime": True, "showLabels": False, "showCommonLabels": False, "wrapLogMessage": True,
                         "prettifyLogMessage": False, "enableLogDetails": True, "dedupStrategy": "none",
                         "sortOrder": "Descending"}}
        self._add(p, w, h)

    def traces(self, title, traceql, w=24, h=8, desc=""):
        p = {"type": "table", "title": title, "description": desc, "datasource": TEMPO,
             "targets": [{"datasource": TEMPO, "refId": "A", "queryType": "traceql", "query": traceql,
                          "limit": 20, "tableType": "traces"}],
             "fieldConfig": {"defaults": {}, "overrides": []}, "options": {"showHeader": True}}
        self._add(p, w, h)

    def text(self, content, w=24, h=3):
        self._add({"type": "text", "title": "", "options": {"mode": "markdown", "content": content}}, w, h)

    def save(self, path):
        json.dump(self.d, open(path, "w"), indent=2)
        print("wrote", path, "-", sum(1 for p in self.d["panels"] if p["type"] != "row"), "panels")


# mapping helpers
UP_DOWN = [{"type": "value", "options": {"0": {"text": "DOWN", "color": "red", "index": 0},
                                         "1": {"text": "UP", "color": "green", "index": 1}}}]
