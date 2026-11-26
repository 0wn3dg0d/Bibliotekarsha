import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  applyFullBackup,
  createFullBackup,
  inspectBackupJson,
  triggerBackupDownload,
} from '../../services/backupService';

interface BackupModalProps {
  onClose: () => void;
  onRestored: (summary: string) => void;
}

export function BackupModal({ onClose, onRestored }: BackupModalProps) {
  const [rawJson, setRawJson] = useState('');
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [exportStatus, setExportStatus] = useState<string | null>(null);
  const [mode, setMode] = useState<'merge' | 'overwrite'>('merge');
  const [restoreSettings, setRestoreSettings] = useState(true);
  const [restorePresets, setRestorePresets] = useState(true);
  const [restoreSharedData, setRestoreSharedData] = useState(true);
  const [restoreWatcher, setRestoreWatcher] = useState(true);
  const overlayRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const targetWin = overlayRef.current?.ownerDocument?.defaultView || window;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        e.stopImmediatePropagation();
        onClose();
      }
    };
    targetWin.addEventListener('keydown', onKey, true);
    return () => targetWin.removeEventListener('keydown', onKey, true);
  }, [onClose]);

  const parsed = useMemo(() => inspectBackupJson(rawJson), [rawJson]);

  const handleExport = async () => {
    setExporting(true);
    setExportStatus(null);
    try {
      const payload = await createFullBackup();
      triggerBackupDownload(payload);
      const { stats } = inspectBackupJson(JSON.stringify(payload));
      setExportStatus(
        `Файл сохранён! Заметок: ${stats.notesCount} · Лок. желаемое: ${stats.incognitoWishlistCount} · Скрытых новостей: ${stats.hiddenNewsCount} · Шаблонов: ${stats.presetsCount} · Профилей Наблюдателя: ${stats.watcherProfilesCount}`
      );
    } catch {
      setExportStatus('Ошибка при формировании бэкапа.');
    } finally {
      setExporting(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      setRawJson(String(ev.target?.result || ''));
    };
    reader.readAsText(file, 'UTF-8');
  };

  const handleImport = async () => {
    if (!parsed.stats.valid || !parsed.payload) return;
    setImporting(true);
    try {
      const parts = await applyFullBackup(parsed.payload, {
        restoreSettings,
        restorePresets,
        restoreSharedData,
        restoreWatcher,
        mode,
      });
      onRestored(
        parts.length > 0
          ? `Восстановлено из бэкапа: ${parts.join(', ')}.`
          : 'Ни один раздел не был выбран для восстановления.'
      );
      onClose();
    } finally {
      setImporting(false);
    }
  };

  return (
    <div
      ref={overlayRef}
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(8, 11, 16, 0.84)',
        backdropFilter: 'blur(3px)',
        zIndex: 1000015,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '640px',
          maxWidth: '94vw',
          maxHeight: '88vh',
          backgroundColor: '#1b2430',
          border: '1px solid #4b6582',
          borderRadius: '6px',
          boxShadow: '0 14px 48px rgba(0, 0, 0, 0.9)',
          display: 'flex',
          flexDirection: 'column',
          color: '#c6d4df',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            padding: '13px 18px',
            backgroundColor: '#121821',
            borderBottom: '1px solid #263241',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <span style={{ fontSize: '16px', fontWeight: 700, color: '#67c1f5' }}>
            💾 Экспорт и импорт данных Bibliotekarsha
          </span>
          <button
            type="button"
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: '#8f98a0', fontSize: '24px', cursor: 'pointer', lineHeight: 1 }}
          >
            ×
          </button>
        </div>

        <div className="bib-bsh-scroll" style={{ padding: '18px 20px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ background: '#121821', border: '1px solid #263241', borderRadius: '5px', padding: '14px 16px' }}>
            <div style={{ fontSize: '14px', fontWeight: 700, color: '#e5eef5', marginBottom: '6px' }}>
              Экспорт единой резервной копии
            </div>
            <div style={{ fontSize: '12.5px', color: '#8f98a0', lineHeight: 1.45, marginBottom: '12px' }}>
              Выгружает в один JSON-файл все настройки модулей и режимов, шаблоны фильтров библиотеки, базу Наблюдателя (все профили), личные заметки и оценки, локальный список желаемого, скрытые новости и настройки SalesMaster.
            </div>
            <button
              type="button"
              disabled={exporting}
              onClick={handleExport}
              className="bib-bsh-btn"
              style={{
                background: 'linear-gradient(to right, #47bfff 0%, #1a44c2 100%)',
                border: 'none',
                color: '#fff',
                fontWeight: 700,
                padding: '8px 18px',
              }}
            >
              {exporting ? 'Формирование файла...' : '⬇ Скачать полный бэкап (.json)'}
            </button>
            {exportStatus && (
              <div style={{ marginTop: '10px', fontSize: '12px', color: '#77dd77', lineHeight: 1.4 }}>
                {exportStatus}
              </div>
            )}
          </div>

          <div style={{ background: '#121821', border: '1px solid #263241', borderRadius: '5px', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ fontSize: '14px', fontWeight: 700, color: '#e5eef5' }}>
              Импорт из резервной копии
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              <input type="file" accept=".json" onChange={handleFileChange} style={{ fontSize: '12.5px', color: '#c6d4df' }} />
            </div>
            <textarea
              value={rawJson}
              onChange={(e) => setRawJson(e.target.value)}
              placeholder="Или вставьте содержимое JSON-файла бэкапа сюда..."
              style={{
                width: '100%',
                boxSizing: 'border-box',
                height: '110px',
                background: '#0d1218',
                color: '#c6d4df',
                border: '1px solid #303d4e',
                borderRadius: '4px',
                padding: '8px 10px',
                fontFamily: 'monospace',
                fontSize: '12px',
                resize: 'vertical',
                outline: 'none',
              }}
            />

            <div
              style={{
                padding: '9px 12px',
                borderRadius: '4px',
                background: '#17202b',
                border: `1px solid ${parsed.stats.valid ? 'rgba(119, 221, 119, 0.4)' : '#2a384a'}`,
                fontSize: '12px',
                lineHeight: 1.5,
                color: parsed.stats.valid ? '#a7e8a7' : rawJson.trim() ? '#ff8e8e' : '#8f98a0',
              }}
            >
              {parsed.stats.valid ? (
                <div>
                  <div>
                    <b>Бэкап распознан</b>
                    {parsed.stats.exportedAt ? ` (от ${new Date(parsed.stats.exportedAt).toLocaleString('ru-RU')})` : ''}
                  </div>
                  <div style={{ color: '#c6d4df', marginTop: '3px' }}>
                    Заметок: <b>{parsed.stats.notesCount}</b> · Лок. желаемое: <b>{parsed.stats.incognitoWishlistCount}</b> ·
                    Скрытых новостей: <b>{parsed.stats.hiddenNewsCount}</b> · Шаблонов: <b>{parsed.stats.presetsCount}</b> ·
                    Профилей Наблюдателя: <b>{parsed.stats.watcherProfilesCount}</b>
                  </div>
                </div>
              ) : (
                parsed.stats.error
              )}
            </div>

            {parsed.stats.valid && (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', fontSize: '12.5px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '7px', cursor: 'pointer' }}>
                    <input type="checkbox" checked={restoreSettings} onChange={(e) => setRestoreSettings(e.target.checked)} style={{ accentColor: '#66c0f4' }} />
                    <span>Настройки модулей и режимов</span>
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '7px', cursor: 'pointer' }}>
                    <input type="checkbox" checked={restorePresets} onChange={(e) => setRestorePresets(e.target.checked)} style={{ accentColor: '#66c0f4' }} />
                    <span>Шаблоны фильтров ({parsed.stats.presetsCount})</span>
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '7px', cursor: 'pointer' }}>
                    <input type="checkbox" checked={restoreSharedData} onChange={(e) => setRestoreSharedData(e.target.checked)} style={{ accentColor: '#66c0f4' }} />
                    <span>Заметки, желаемое, новости, SM</span>
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '7px', cursor: 'pointer' }}>
                    <input type="checkbox" checked={restoreWatcher} onChange={(e) => setRestoreWatcher(e.target.checked)} style={{ accentColor: '#66c0f4' }} />
                    <span>База Наблюдателя</span>
                  </label>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '16px', fontSize: '12.5px', paddingTop: '4px' }}>
                  <span style={{ color: '#8f98a0' }}>Режим:</span>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                    <input type="radio" name="bshBackupMode" checked={mode === 'merge'} onChange={() => setMode('merge')} style={{ accentColor: '#66c0f4' }} />
                    <span>Объединить (безопасно)</span>
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                    <input type="radio" name="bshBackupMode" checked={mode === 'overwrite'} onChange={() => setMode('overwrite')} style={{ accentColor: '#ff7b72' }} />
                    <span>Перезаписать целиком</span>
                  </label>
                </div>
              </>
            )}
          </div>
        </div>

        <div
          style={{
            padding: '10px 18px',
            backgroundColor: '#121821',
            borderTop: '1px solid #263241',
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '10px',
          }}
        >
          <button type="button" onClick={onClose} className="bib-bsh-btn">
            Закрыть
          </button>
          <button
            type="button"
            disabled={!parsed.stats.valid || importing}
            onClick={handleImport}
            className="bib-bsh-btn"
            style={{
              background: parsed.stats.valid ? '#238636' : undefined,
              borderColor: parsed.stats.valid ? '#3fb950' : undefined,
              color: parsed.stats.valid ? '#ffffff' : undefined,
              opacity: parsed.stats.valid ? 1 : 0.45,
              fontWeight: 700,
            }}
          >
            {importing ? 'Восстановление...' : 'Восстановить выбранное'}
          </button>
        </div>
      </div>
    </div>
  );
}
