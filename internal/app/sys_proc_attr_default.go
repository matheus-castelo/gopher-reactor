//go:build !windows

package app

import (
	"os/exec"
)

func setHideWindow(cmd *exec.Cmd) {
}
