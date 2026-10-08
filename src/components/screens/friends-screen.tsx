import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Avatar, Card, EmptyState, Icon, SectionHeader } from '@/components/flexin/ui';
import { Colors, Radius, Space, Type } from '@/constants/flexin-theme';
import type { Friend, FriendRequest, UserSummary } from '@/data/mock-data';
import { ApiError, NetworkError } from '@/lib/api';
import { useMe } from '@/stores/auth-store';
import { friendsActions, useFriendsStore } from '@/stores/friends-store';
import { formatFriendCode, isValidFriendCode, normalizeFriendCode } from '@/utils/friend-code';
import { timeAgo } from '@/utils/format';

type Segment = 'friends' | 'add' | 'requests';

function errorText(e: unknown): string {
  if (e instanceof NetworkError) return "Can't reach the server. Check your connection.";
  if (e instanceof ApiError) return e.message;
  return 'Something went wrong. Try again.';
}

export function FriendsScreen() {
  const [segment, setSegment] = useState<Segment>('friends');
  const friends = useFriendsStore((s) => s.friends);
  const requests = useFriendsStore((s) => s.requests);
  const status = useFriendsStore((s) => s.status);
  const loadError = useFriendsStore((s) => s.error);
  const refreshing = useFriendsStore((s) => s.refreshing);
  // The request whose Accept/Decline/Cancel is in flight, and what went wrong last.
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // Requests arrive from other people, so re-check whenever the tab is opened.
  useFocusEffect(
    useCallback(() => {
      friendsActions.load();
    }, []),
  );

  const incoming = requests.filter((r) => r.direction === 'incoming');
  const outgoing = requests.filter((r) => r.direction === 'outgoing');

  async function act(request: FriendRequest, action: (id: string) => Promise<void>) {
    setBusyId(request.id);
    setActionError(null);
    try {
      await action(request.id);
    } catch (e) {
      setActionError(errorText(e));
      // e.g. 404: they cancelled meanwhile. Re-sync so the list matches the server.
      friendsActions.load();
    } finally {
      setBusyId(null);
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => friendsActions.load()} tintColor={Colors.text} />
        }>
        <Text style={[Type.title, { color: Colors.text }]}>Friends</Text>
        <Text style={[Type.caption, { color: Colors.textMuted }]}>
          {status === 'ready' ? (friends.length === 1 ? '1 friend' : `${friends.length} friends`) : ' '}
        </Text>

        <SegmentedControl
          value={segment}
          onChange={(next) => {
            setSegment(next);
            setActionError(null);
          }}
          options={[
            { value: 'friends', label: 'Friends' },
            { value: 'add', label: 'Add' },
            { value: 'requests', label: 'Requests', badge: incoming.length },
          ]}
        />

        {segment === 'add' ? (
          <AddFriends />
        ) : status === 'idle' || status === 'loading' ? (
          <View style={styles.loading}>
            <ActivityIndicator color={Colors.textMuted} />
          </View>
        ) : status === 'error' ? (
          <Card style={styles.section}>
            <EmptyState title="Couldn't load your friends" body={loadError ?? 'Something went wrong.'} />
            <Pressable
              onPress={() => friendsActions.load()}
              accessibilityRole="button"
              style={({ pressed }) => [styles.retryButton, pressed && styles.pressed]}>
              <Text style={[Type.bodyStrong, { color: Colors.text }]}>Try again</Text>
            </Pressable>
          </Card>
        ) : segment === 'friends' ? (
          <FriendsList friends={friends} onAdd={() => setSegment('add')} />
        ) : (
          <Requests
            incoming={incoming}
            outgoing={outgoing}
            busyId={busyId}
            error={actionError}
            onAccept={(r) => act(r, friendsActions.accept)}
            onRemove={(r) => act(r, friendsActions.remove)}
          />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function SegmentedControl({
  value,
  onChange,
  options,
}: {
  value: Segment;
  onChange: (v: Segment) => void;
  options: { value: Segment; label: string; badge?: number }[];
}) {
  return (
    <View style={styles.segments} accessibilityRole="tablist">
      {options.map((o) => {
        const selected = o.value === value;
        return (
          <Pressable
            key={o.value}
            onPress={() => onChange(o.value)}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            style={[styles.segment, selected && styles.segmentSelected]}>
            <Text style={[Type.bodyStrong, { color: selected ? Colors.text : Colors.textMuted }]}>{o.label}</Text>
            {o.badge ? (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{o.badge}</Text>
              </View>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}

function PersonRow({
  user,
  subtitle,
  last,
  children,
}: {
  user: UserSummary;
  subtitle: string;
  last: boolean;
  children?: ReactNode;
}) {
  return (
    <View style={[styles.row, !last && styles.divider]}>
      <Avatar name={user.name} size={40} />
      <View style={{ flex: 1 }}>
        <Text style={[Type.bodyStrong, { color: Colors.text }]} numberOfLines={1}>
          {user.name}
        </Text>
        <Text style={[Type.caption, { color: Colors.textMuted }]} numberOfLines={1}>
          {subtitle}
        </Text>
      </View>
      {children}
    </View>
  );
}

function FriendsList({ friends, onAdd }: { friends: Friend[]; onAdd: () => void }) {
  if (friends.length === 0) {
    return (
      <Card style={styles.section}>
        <EmptyState title="No friends yet" body="Add friends with their friend code to start competing." />
        <Pressable
          onPress={onAdd}
          accessibilityRole="button"
          style={({ pressed }) => [styles.primaryButton, styles.emptyButton, pressed && styles.pressed]}>
          <Icon name="plus" size={16} color={Colors.onPrimary} />
          <Text style={[Type.bodyStrong, { color: Colors.onPrimary }]}>Add friends</Text>
        </Pressable>
      </Card>
    );
  }
  return (
    <Card style={[styles.section, styles.listCard]}>
      {friends.map((f, i) => (
        <PersonRow
          key={f.user.id}
          user={f.user}
          subtitle={`@${f.user.handle}`}
          last={i === friends.length - 1}>
          <Pressable
            onPress={() => router.push({ pathname: '/challenge/new', params: { friend: f.user.id } })}
            accessibilityRole="button"
            accessibilityLabel={`Challenge ${f.user.name}`}
            style={({ pressed }) => [styles.smallPrimary, pressed && styles.pressed]}>
            <Text style={[Type.caption, { color: Colors.onPrimary, fontWeight: '800' }]}>Challenge</Text>
          </Pressable>
        </PersonRow>
      ))}
    </Card>
  );
}

function AddFriends() {
  const [code, setCode] = useState('');
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState<{ kind: 'error' | 'success'; text: string } | null>(null);
  const [focused, setFocused] = useState(false);
  const me = useMe();
  const myCode = formatFriendCode(me.friendCode);

  async function shareCode() {
    try {
      await Share.share({ message: `Add me on Flexin'! My friend code is ${myCode}` });
    } catch {
      // Share sheet unavailable (e.g. some web browsers); the code is on screen to copy.
    }
  }

  async function submit() {
    if (!isValidFriendCode(code)) {
      setMessage({ kind: 'error', text: 'Friend codes are 8 characters, like 7K2Q-9MXP.' });
      return;
    }
    if (code === me.friendCode) {
      setMessage({ kind: 'error', text: "That's your own code." });
      return;
    }
    setSending(true);
    setMessage(null);
    try {
      // The server checks the rest: unknown code, already friends, already requested.
      const request = await friendsActions.sendRequest(code);
      setCode('');
      setMessage({ kind: 'success', text: `Request sent to ${request.user.name}. It's under Requests until they accept.` });
    } catch (e) {
      setMessage({ kind: 'error', text: errorText(e) });
    } finally {
      setSending(false);
    }
  }

  const canSubmit = code.length === 8 && !sending;

  return (
    <View style={styles.section}>
      <Card style={styles.codeCard}>
        <Text style={[Type.label, { color: Colors.textMuted }]}>Your friend code</Text>
        <Text selectable style={styles.myCode}>
          {myCode}
        </Text>
        <Pressable
          onPress={shareCode}
          accessibilityRole="button"
          style={({ pressed }) => [styles.outlineButton, pressed && styles.pressed]}>
          <Icon name="share" size={15} />
          <Text style={[Type.bodyStrong, { color: Colors.text }]}>Share code</Text>
        </Pressable>
      </Card>

      <SectionHeader title="Enter a friend code" />
      <Card>
        <TextInput
          value={formatFriendCode(code)}
          onChangeText={(t) => {
            setCode(normalizeFriendCode(t));
            setMessage(null);
          }}
          onSubmitEditing={submit}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder="XXXX-XXXX"
          placeholderTextColor={Colors.textFaint}
          autoCapitalize="characters"
          autoCorrect={false}
          autoComplete="off"
          maxLength={9}
          returnKeyType="send"
          accessibilityLabel="Friend code"
          style={[styles.codeInput, focused && styles.codeInputFocused]}
        />
        {message ? (
          <Text
            style={[
              Type.caption,
              styles.message,
              { color: message.kind === 'error' ? Colors.text : Colors.textMuted },
              message.kind === 'error' && { fontWeight: '800' },
            ]}>
            {message.text}
          </Text>
        ) : null}
        <Pressable
          onPress={submit}
          disabled={!canSubmit}
          accessibilityRole="button"
          accessibilityState={{ disabled: !canSubmit }}
          style={({ pressed }) => [
            styles.primaryButton,
            { marginTop: Space.md },
            !canSubmit && styles.disabled,
            pressed && styles.pressed,
          ]}>
          {sending ? (
            <ActivityIndicator color={Colors.onPrimary} />
          ) : (
            <Text style={[Type.bodyStrong, { color: Colors.onPrimary }]}>Send request</Text>
          )}
        </Pressable>
      </Card>
    </View>
  );
}

function Requests({
  incoming,
  outgoing,
  busyId,
  error,
  onAccept,
  onRemove,
}: {
  incoming: FriendRequest[];
  outgoing: FriendRequest[];
  busyId: string | null;
  error: string | null;
  onAccept: (r: FriendRequest) => void;
  onRemove: (r: FriendRequest) => void;
}) {
  return (
    <View>
      {error ? (
        <Text style={[Type.caption, styles.actionError]} accessibilityRole="alert">
          {error}
        </Text>
      ) : null}
      <SectionHeader title={`Incoming${incoming.length ? ` · ${incoming.length}` : ''}`} />
      {incoming.length === 0 ? (
        <Card>
          <EmptyState title="No incoming requests" body="When someone adds your friend code, it shows up here." />
        </Card>
      ) : (
        <Card style={styles.listCard}>
          {incoming.map((r, i) => (
            <PersonRow
              key={r.id}
              user={r.user}
              subtitle={`@${r.user.handle} · ${timeAgo(r.createdAt)}`}
              last={i === incoming.length - 1}>
              {busyId === r.id ? <ActivityIndicator color={Colors.textMuted} /> : null}
              <Pressable
                onPress={() => onRemove(r)}
                disabled={busyId !== null}
                accessibilityRole="button"
                accessibilityLabel={`Decline ${r.user.name}`}
                style={({ pressed }) => [styles.smallOutline, pressed && styles.pressed]}>
                <Text style={[Type.caption, { color: Colors.text, fontWeight: '800' }]}>Decline</Text>
              </Pressable>
              <Pressable
                onPress={() => onAccept(r)}
                disabled={busyId !== null}
                accessibilityRole="button"
                accessibilityLabel={`Accept ${r.user.name}`}
                style={({ pressed }) => [styles.smallPrimary, pressed && styles.pressed]}>
                <Text style={[Type.caption, { color: Colors.onPrimary, fontWeight: '800' }]}>Accept</Text>
              </Pressable>
            </PersonRow>
          ))}
        </Card>
      )}

      <SectionHeader title={`Sent${outgoing.length ? ` · ${outgoing.length}` : ''}`} />
      {outgoing.length === 0 ? (
        <Card>
          <EmptyState title="No sent requests" body="Requests you send stay here until they're accepted." />
        </Card>
      ) : (
        <Card style={styles.listCard}>
          {outgoing.map((r, i) => (
            <PersonRow
              key={r.id}
              user={r.user}
              subtitle={`Sent ${timeAgo(r.createdAt)}`}
              last={i === outgoing.length - 1}>
              {busyId === r.id ? <ActivityIndicator color={Colors.textMuted} /> : null}
              <Pressable
                onPress={() => onRemove(r)}
                disabled={busyId !== null}
                accessibilityRole="button"
                accessibilityLabel={`Cancel request to ${r.user.name}`}
                style={({ pressed }) => [styles.smallOutline, pressed && styles.pressed]}>
                <Text style={[Type.caption, { color: Colors.text, fontWeight: '800' }]}>Cancel</Text>
              </Pressable>
            </PersonRow>
          ))}
        </Card>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    padding: Space.lg,
    paddingBottom: Space.xxl * 2,
    width: '100%',
    maxWidth: 640,
    alignSelf: 'center',
  },
  segments: {
    flexDirection: 'row',
    marginTop: Space.lg,
    padding: 4,
    borderRadius: Radius.md,
    backgroundColor: Colors.wash,
  },
  segment: {
    flex: 1,
    height: 38,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: Radius.sm,
  },
  segmentSelected: {
    backgroundColor: Colors.surface,
  },
  badge: {
    minWidth: 18,
    height: 18,
    paddingHorizontal: 5,
    borderRadius: 9,
    backgroundColor: Colors.text,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    color: Colors.surface,
    fontSize: 11,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
  },
  loading: {
    paddingVertical: Space.xxl,
    alignItems: 'center',
  },
  retryButton: {
    marginTop: Space.lg,
    height: 44,
    borderRadius: Radius.md,
    borderWidth: 1.5,
    borderColor: Colors.text,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionError: {
    color: Colors.text,
    fontWeight: '800',
    marginTop: Space.lg,
  },
  section: {
    marginTop: Space.lg,
  },
  listCard: {
    paddingVertical: Space.xs,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.md,
    paddingVertical: Space.md,
  },
  divider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.line,
  },
  codeCard: {
    alignItems: 'center',
    gap: Space.sm,
  },
  myCode: {
    color: Colors.text,
    fontSize: 34,
    fontWeight: '900',
    letterSpacing: 3,
    fontVariant: ['tabular-nums'],
  },
  codeInput: {
    height: 52,
    borderRadius: Radius.md,
    borderWidth: 1.5,
    borderColor: Colors.line,
    backgroundColor: Colors.wash,
    paddingHorizontal: Space.lg,
    color: Colors.text,
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: 2,
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
    // Web: drop the browser focus ring (it reads as a plate color); focus shows as an ink border.
    outlineWidth: 0,
    outlineStyle: 'solid',
  },
  codeInputFocused: {
    borderColor: Colors.text,
  },
  message: {
    marginTop: Space.sm,
    textAlign: 'center',
  },
  primaryButton: {
    height: 48,
    borderRadius: Radius.md,
    backgroundColor: Colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Space.sm,
  },
  emptyButton: {
    marginTop: Space.lg,
  },
  outlineButton: {
    marginTop: Space.xs,
    height: 40,
    paddingHorizontal: Space.lg,
    borderRadius: Radius.pill,
    borderWidth: 1.5,
    borderColor: Colors.text,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.sm,
  },
  smallOutline: {
    height: 32,
    paddingHorizontal: Space.md,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: Colors.line,
    justifyContent: 'center',
  },
  smallPrimary: {
    height: 32,
    paddingHorizontal: Space.md,
    borderRadius: Radius.pill,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
  },
  disabled: {
    opacity: 0.4,
  },
  pressed: {
    opacity: 0.7,
  },
});
