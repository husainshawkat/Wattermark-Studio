/* ============================================================
   exif-reader.js — extracts camera/lens/exposure/GPS metadata
   from an uploaded image using exif-js. Fully client-side.
   ============================================================ */
'use strict';

HWS.exifReader = {
  /**
   * Reads EXIF tags from a File or HTMLImageElement.
   * Resolves to a normalized, always-present object so callers
   * never need to null-check individual fields.
   */
  read(fileOrImg) {
    return new Promise((resolve) => {
      const empty = {
        date: '', time: '', camera: '', lens: '', iso: '',
        aperture: '', shutter: '', gps: '', raw: null,
      };
      if (typeof EXIF === 'undefined') return resolve(empty);

      const handleTags = (tags) => {
        if (!tags || Object.keys(tags).length === 0) return resolve(empty);

        let date = '', time = '';
        const dt = tags.DateTimeOriginal || tags.DateTime;
        if (dt) {
          const [d, t] = String(dt).split(' ');
          date = (d || '').replace(/:/g, '-');
          time = t || '';
        }

        const make = tags.Make ? String(tags.Make).trim() : '';
        const model = tags.Model ? String(tags.Model).trim() : '';
        const camera = [make, model].filter(Boolean).join(' ');
        const lens = tags.LensModel ? String(tags.LensModel).trim() : '';
        const iso = tags.ISOSpeedRatings ? `ISO ${tags.ISOSpeedRatings}` : '';
        const aperture = tags.FNumber ? `f/${tags.FNumber}` : '';
        const shutter = tags.ExposureTime
          ? tags.ExposureTime < 1
            ? `1/${Math.round(1 / tags.ExposureTime)}s`
            : `${tags.ExposureTime}s`
          : '';

        let gps = '';
        if (tags.GPSLatitude && tags.GPSLongitude) {
          const toDeg = (arr, ref) => {
            const d = arr[0] + arr[1] / 60 + arr[2] / 3600;
            return ref === 'S' || ref === 'W' ? -d : d;
          };
          const lat = toDeg(tags.GPSLatitude, tags.GPSLatitudeRef);
          const lon = toDeg(tags.GPSLongitude, tags.GPSLongitudeRef);
          gps = `${lat.toFixed(5)}, ${lon.toFixed(5)}`;
        }

        resolve({ date, time, camera, lens, iso, aperture, shutter, gps, raw: tags });
      };

      try {
        if (fileOrImg instanceof File) {
          EXIF.getData(fileOrImg, function () {
            handleTags(EXIF.getAllTags(this));
          });
        } else {
          EXIF.getData(fileOrImg, function () {
            handleTags(EXIF.getAllTags(this));
          });
        }
      } catch (e) {
        resolve(empty);
      }
    });
  },

  /** Replace {variable} tokens in a template string with EXIF/general data. */
  applyTemplate(template, data, extra = {}) {
    const now = new Date();
    const map = {
      '{date}': data.date || HWS.utils.formatDate(now),
      '{time}': data.time || HWS.utils.formatTime(now),
      '{camera}': data.camera || 'Unknown camera',
      '{lens}': data.lens || 'Unknown lens',
      '{iso}': data.iso || '',
      '{aperture}': data.aperture || '',
      '{shutter}': data.shutter || '',
      '{gps}': data.gps || '',
      '{filename}': extra.filename || 'image',
      ...extra,
    };
    return template.replace(/\{[a-z]+\}/gi, (token) => (token in map ? map[token] : token));
  },
};
