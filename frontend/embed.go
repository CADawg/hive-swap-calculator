package frontend

import (
	"embed"
	"io/fs"
	"path/filepath"
)

//go:embed all:dist
var distDir embed.FS

// RootDir contains the embedded dist directory files (without the "dist" prefix)
var RootDir = MustSubFS(distDir, "dist")

func subFS(currentFs fs.FS, root string) (fs.FS, error) {
	root = filepath.ToSlash(filepath.Clean(root)) // note: fs.FS operates only with slashes. `ToSlash` is necessary for Windows
	return fs.Sub(currentFs, root)
}

func MustSubFS(currentFs fs.FS, root string) fs.FS {
	fsOut, err := subFS(currentFs, root)
	if err != nil {
		panic(err)
	}
	return fsOut
}
