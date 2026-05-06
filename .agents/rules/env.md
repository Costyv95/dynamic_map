# Environment Rule

All Python and pip commands for this project **MUST** be executed within the `water` conda environment.

## Activation

```bash
conda activate water
```

## Command Execution

When running any Python script, pip install, or tool (e.g., `esphome`), always prefix with:

```bash
conda run -n water <command>
```

Or activate the environment first in a persistent terminal:

```bash
conda activate water
```

## Do NOT

- Install packages into the system Python or `base` conda environment.
- Run `esphome`, `pytest`, or any project tool outside the `water` environment.
