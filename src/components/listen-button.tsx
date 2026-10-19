import { setAudioModeAsync, useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { BigButton } from '@/components/big-button';
import { PauseIcon, PlayIcon } from '@/components/icons';
import { t } from '@/i18n';
import { chapterAudio } from '@/lib/talk';
import { fontWeight } from '@/theme';

const text = t.chapter;

/**
 * "Escuchar mi historia": Hilo reads the chapter with the voice she knows from the talk.
 * One big button that plays, pauses and plays again from the start once it ends.
 */
export function ListenButton({ chapterId }: { chapterId: string }) {
  const player = useAudioPlayer();
  const status = useAudioPlayerStatus(player);
  const [state, setState] = useState<'idle' | 'loading' | 'ready' | 'failed'>('idle');

  // Read to the end: the button offers to listen again from the start
  const ended = status.didJustFinish || (status.duration > 0 && status.currentTime >= status.duration - 0.5);

  const press = async () => {
    if (state === 'loading') return;
    if (state === 'ready') {
      if (status.playing) return player.pause();
      // Finished: start again from the beginning
      if (ended) await player.seekTo(0);
      return player.play();
    }
    setState('loading');
    const url = await chapterAudio(chapterId);
    if (!url) return setState('failed');
    // Out loud even with the iPhone on silent, like the talk
    await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: false, interruptionMode: 'duckOthers' });
    player.replace({ uri: url });
    player.play();
    setState('ready');
  };

  const playing = state === 'ready' && status.playing;
  const started = state === 'ready' && status.currentTime > 0.5 && !ended;
  const label =
    state === 'loading' ? text.listenPreparing : playing ? text.listenPause : started ? text.listenResume : text.listen;

  return (
    <View style={styles.wrap}>
      <BigButton label={label} icon={playing ? <PauseIcon /> : <PlayIcon />} onPress={press} />
      {state === 'failed' ? <Text style={styles.error}>{text.listenFailed}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginTop: 26,
    gap: 10,
  },
  error: {
    fontSize: 18,
    lineHeight: 24,
    fontWeight: fontWeight.semibold,
    color: '#b3261e',
    textAlign: 'center',
  },
});
