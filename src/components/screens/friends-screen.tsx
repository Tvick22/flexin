import { useState, type ReactNode } from 'react';
import { Pressable, ScrollView, Share, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Avatar, Card, EmptyState, Icon, SectionHeader } from '@/components/flexin/ui';
import { Colors, Radius, Space, Type } from '@/constants/flexin-theme';
import {
  mockFriendCodeDirectory,
  mockFriendRequests,
  mockFriends,
  mockMe,
  type Friend,
  type FriendRequest,
  type UserSummary,
} from '@/data/mock-data';
import { formatFriendCode, isValidFriendCode, normalizeFriendCode } from '@/utils/friend-code';
import { timeAgo } from '@/utils/format';

type Segment = 'friends' | 'add' | 'requests';

export function FriendsScreen() {
  const [segment, setSegment] = useState<Segment>('friends');
  // Local state until the API exists; each mutation maps to one REST call.
  const [friends, setFriends] = useState<Friend[]>(mockFriends);
  const [requests, setRequests] = useState<FriendRequest[]>(mockFriendRequests);

  const incoming = requests.filter((r) => r.direction === 'incoming');
  const outgoing = requests.filter((r) => r.direction === 'outgoing');

  function sendRequest(user: UserSummary) {
    setRequests((rs) => [
      { id: `req_${user.id}_${Date.now()}`, direction: 'outgoing', user, createdAt: new Date().toISOString() },
      ...rs,
    ]);
  }

  function accept(request: FriendRequest) {
    setRequests((rs) => rs.filter((r) => r.id !== request.id));
    setFriends((fs) => [{ user: request.user, since: new Date().toISOString() }, ...fs]);
  }

  function remove(request: FriendRequest) {
    setRequests((rs) => rs.filter((r) => r.id !== request.id));
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>
        <Text style={[Type.title, { color: Colors.text }]}>Friends</Text>
        <Text style={[Type.caption, { color: Colors.textMuted }]}>
          {friends.length === 1 ? '1 friend' : `${friends.length} friends`}
        </Text>

        <SegmentedControl
          value={segment}
          onChange={setSegment}
          options={[
            { value: 'friends', label: 'Friends' },
            { value: 'add', label: 'Add' },
            { value: 'requests', label: 'Requests', badge: incoming.length },
          ]}
        />

        {segment === 'friends' ? <FriendsList friends={friends} onAdd={() => setSegment('add')} /> : null}
        {segment === 'add' ? <AddFriends friends={friends} requests={requests} onSend={sendRequest} /> : null}
        {segment === 'requests' ? (
          <Requests incoming={incoming} outgoing={outgoing} onAccept={accept} onRemove={remove} />
        ) : null}
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
          subtitle={`@${f.user.handle} · friends since ${timeAgo(f.since)}`}
          last={i === friends.length - 1}
        />
      ))}
    </Card>
  );
}

function AddFriends({
  friends,
  requests,
  onSend,
}: {
  friends: Friend[];
  requests: FriendRequest[];
  onSend: (user: UserSummary) => void;
}) {
  const [code, setCode] = useState('');
  const [message, setMessage] = useState<{ kind: 'error' | 'success'; text: string } | null>(null);
  const [focused, setFocused] = useState(false);
  const myCode = formatFriendCode(mockMe.friendCode);

  async function shareCode() {
    try {
      await Share.share({ message: `Add me on Flexin'! My friend code is ${myCode}` });
    } catch {
      // Share sheet unavailable (e.g. some web browsers); the code is on screen to copy.
    }
  }

  function submit() {
    if (!isValidFriendCode(code)) {
      setMessage({ kind: 'error', text: 'Friend codes are 8 characters, like 7K2Q-9MXP.' });
      return;
    }
    if (code === mockMe.friendCode) {
      setMessage({ kind: 'error', text: "That's your own code." });
      return;
    }
    const user = mockFriendCodeDirectory[code];
    if (!user) {
      setMessage({ kind: 'error', text: 'No one has that code. Double-check it and try again.' });
      return;
    }
    const first = user.name.split(' ')[0];
    if (friends.some((f) => f.user.id === user.id)) {
      setMessage({ kind: 'error', text: `You're already friends with ${first}.` });
      return;
    }
    const existing = requests.find((r) => r.user.id === user.id);
    if (existing) {
      setMessage({
        kind: 'error',
        text:
          existing.direction === 'outgoing'
            ? `You already sent ${first} a request.`
            : `${first} already sent you a request. Check Requests.`,
      });
      return;
    }
    onSend(user);
    setCode('');
    setMessage({ kind: 'success', text: `Request sent to ${user.name}.` });
  }

  const canSubmit = code.length === 8;

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
          <Text style={[Type.bodyStrong, { color: Colors.onPrimary }]}>Send request</Text>
        </Pressable>
      </Card>
    </View>
  );
}

function Requests({
  incoming,
  outgoing,
  onAccept,
  onRemove,
}: {
  incoming: FriendRequest[];
  outgoing: FriendRequest[];
  onAccept: (r: FriendRequest) => void;
  onRemove: (r: FriendRequest) => void;
}) {
  return (
    <View>
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
              <Pressable
                onPress={() => onRemove(r)}
                accessibilityRole="button"
                accessibilityLabel={`Decline ${r.user.name}`}
                style={({ pressed }) => [styles.smallOutline, pressed && styles.pressed]}>
                <Text style={[Type.caption, { color: Colors.text, fontWeight: '800' }]}>Decline</Text>
              </Pressable>
              <Pressable
                onPress={() => onAccept(r)}
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
              <Pressable
                onPress={() => onRemove(r)}
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
