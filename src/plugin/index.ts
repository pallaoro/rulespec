/**
 * rulespec — OpenClaw plugin entry.
 *
 * rulespec is primarily a standalone CLI + library; this plugin entry exists
 * so the package can be installed via `openclaw plugins install rulespec`,
 * which publishes the bundled skill at `skills/rulespec/SKILL.md` into
 * agents' `<available_skills>` and keeps the package versioned through the
 * OpenClaw plugin update path.
 *
 * No native OpenClaw tools or hooks are registered — the skill instructs
 * agents to use the documented `rulespec` CLI commands via `exec`.
 */

interface PluginApi {
  logger?: {
    info: (msg: string) => void;
  };
}

function register(_api: PluginApi): void {
  // Skill-only plugin: nothing to register at runtime. The manifest's
  // `skills` field publishes skills/rulespec/SKILL.md into the workspace.
}

export default {
  id: "rulespec",
  register,
};
