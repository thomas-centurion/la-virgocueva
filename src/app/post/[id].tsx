import { useCallback, useEffect, useRef, useState, type ReactElement } from 'react';
import { Link, Stack, useLocalSearchParams } from 'expo-router';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { SymbolView } from 'expo-symbols';
import { useAppState } from '@/features/app-state';
import { useAuth } from '@/features/auth/auth-provider';
import type { Comment } from '@/features/mock-data';
import { colors } from '@/constants/theme';
import { Avatar } from '@/components/profiles/avatar';
import { PostActions } from '@/components/posts/post-actions';
import { Button, Field, Screen } from '@/components/ui/primitives';
import { ImageThumbnail } from '@/components/ui/image-viewer';
import { RepostLabel } from '@/components/posts/repost-label';
import { getCommentsForPost, getRepostContext } from '@/features/supabase-social';
import { ActivityIndicator, Alert, FlatList, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

export default function PostDetailScreen() {
  const { id, reposterId } = useLocalSearchParams<{ id: string; reposterId?: string }>();
  const { posts, addComment, deleteComment, toggleLike, toggleRepost } = useAppState();
  const { session } = useAuth();
  const post = posts.find((item) => item.id === id);
  const [text, setText] = useState('');
  const [selectedImage, setSelectedImage] = useState<{ uri: string; base64: string } | null>(null);
  const [pickerBusy, setPickerBusy] = useState(false);
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(true);
  const [commentsError, setCommentsError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const sendingRef = useRef(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [replyingTo, setReplyingTo] = useState<Comment | null>(null);
  const [routeRepost, setRouteRepost] = useState<{ reposterId: string; context: NonNullable<NonNullable<typeof post>['repost']> } | null>(null);

  const loadComments = useCallback(async () => {
    setCommentsLoading(true);
    setCommentsError(null);
    try {
      const result = await getCommentsForPost(id);
      setComments(result);
    } catch (error) {
      console.error('No se pudieron cargar los comentarios de Supabase:', error);
      setCommentsError('No pudimos cargar los comentarios. Revisa tu conexión e inténtalo de nuevo.');
    } finally {
      setCommentsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    let active = true;
    void getCommentsForPost(id).then((result) => {
      if (active) setComments(result);
    }).catch((error: unknown) => {
      console.error('No se pudieron cargar los comentarios de Supabase:', error);
      if (active) setCommentsError('No pudimos cargar los comentarios. Revisa tu conexión e inténtalo de nuevo.');
    }).finally(() => {
      if (active) setCommentsLoading(false);
    });
    return () => { active = false; };
  }, [id]);

  useEffect(() => {
    if (!reposterId) return;
    let active = true;
    void getRepostContext(id, reposterId).then((context) => {
      if (active && context) setRouteRepost({ reposterId, context });
    }).catch((error: unknown) => {
      console.warn('No se pudo recuperar el contexto del Revirg para el detalle:', error);
    });
    return () => { active = false; };
  }, [id, reposterId]);

  if (!post) return <Screen><Stack.Screen options={{ title: 'Publicación', headerShown: true }}/><Text style={styles.missing}>No encontramos esta publicación.</Text></Screen>;
  const activePost = post;
  const routeRepostContext = routeRepost && routeRepost.reposterId === reposterId ? routeRepost.context : undefined;
  const feedRepostContext = !reposterId || activePost.repost?.user.id === reposterId ? activePost.repost : undefined;
  const repostContext = routeRepostContext ?? feedRepostContext;
  const userId = session?.user.id ?? null;

  const author = activePost.author ?? { username: activePost.username, name: activePost.username, bio: '', avatar: null, cover: null };
  const startReply = (comment: Comment) => { setReplyingTo(comment); setText(''); };
  const cancelReply = () => { setReplyingTo(null); setText(''); };
  const submit = async () => {
    const value = text.trim();
    if ((!value && !selectedImage) || !userId || sendingRef.current) return;
    sendingRef.current = true;
    setSending(true);
    try {
      const comment = await addComment(activePost.id, value, userId, replyingTo?.id ?? null, selectedImage?.base64 ?? null);
      setComments((current) => [...current, comment]);
      setText('');
      setSelectedImage(null);
      setReplyingTo(null);
    } catch (error) {
      Alert.alert('No se pudo enviar el comentario', error instanceof Error ? error.message : 'Revisa tu conexión e inténtalo de nuevo.');
    } finally {
      sendingRef.current = false;
      setSending(false);
    }
  };

  const pickCommentImage = async () => {
    if (pickerBusy || sending) return;
    setPickerBusy(true);
    try {
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8, base64: true });
      if (result.canceled) return;
      const asset = result.assets[0];
      if (!asset?.base64) {
        Alert.alert('No se pudo leer la imagen', 'Elige otra imagen e inténtalo de nuevo.');
        return;
      }
      setSelectedImage({ uri: asset.uri, base64: asset.base64 });
    } catch (pickerError) {
      console.error('No se pudo abrir la biblioteca de imágenes:', pickerError);
      Alert.alert('No se pudieron abrir las imágenes', 'Inténtalo de nuevo.');
    } finally {
      setPickerBusy(false);
    }
  };

  const descendantsOf = (parentId: string): string[] => {
    const children = comments.filter((comment) => comment.parentCommentId === parentId);
    return children.flatMap((child) => [child.id, ...descendantsOf(child.id)]);
  };

  const confirmDelete = (comment: Comment) => {
    if (!userId || comment.authorId !== userId) return;
    const removedIds = [comment.id, ...descendantsOf(comment.id)];
    Alert.alert('Borrar comentario', 'También se borrarán sus respuestas.', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Borrar', style: 'destructive', onPress: () => {
        setDeleting(comment.id);
        void deleteComment(comment.id, activePost.id, userId, removedIds.length).then(() => {
          setComments((current) => current.filter((item) => !removedIds.includes(item.id)));
          if (replyingTo && removedIds.includes(replyingTo.id)) cancelReply();
        }).catch((error: unknown) => {
          Alert.alert('No se pudo borrar el comentario', error instanceof Error ? error.message : 'Revisa tu conexión e inténtalo de nuevo.');
        }).finally(() => setDeleting(null));
      } },
    ]);
  };

  function renderComment(comment: Comment, depth = 0): ReactElement {
    const commenter = comment.author ?? { username: 'usuario', name: 'Usuario', bio: '', avatar: null, cover: null };
    const commenterProfile = comment.author?.username
      ? { pathname: '/user/[username]' as const, params: { username: comment.author.username } }
      : null;
    return <View key={comment.id} style={depth > 0 && depth <= 3 ? styles.threadBranch : undefined}>
      <View style={[styles.comment, depth > 0 && styles.nestedComment]}>
        {commenterProfile
          ? <Link href={commenterProfile} asChild><Pressable accessibilityRole="link" accessibilityLabel={`Abrir perfil de @${commenter.username}`}><Avatar uri={commenter.avatar} size={38}/></Pressable></Link>
          : <Avatar uri={commenter.avatar} size={38}/>}
        <View style={styles.commentMain}>
          <View style={styles.commentIdentity}>
            {commenterProfile
              ? <Link href={commenterProfile} asChild><Pressable accessibilityRole="link" accessibilityLabel={`Abrir perfil de ${commenter.name}`}><Text style={styles.name}>{commenter.name}</Text></Pressable></Link>
              : <Text style={styles.name}>{commenter.name}</Text>}
            {commenterProfile
              ? <Link href={commenterProfile} asChild><Pressable accessibilityRole="link" accessibilityLabel={`Abrir perfil de @${commenter.username}`}><Text style={styles.handle}>@{commenter.username}</Text></Pressable></Link>
              : <Text style={styles.handle}>@{commenter.username}</Text>}
            <Text style={styles.handle}>· {comment.time}</Text>
          </View>
          {comment.text ? <Text style={styles.commentText}>{comment.text}</Text> : null}
          {comment.image && <ImageThumbnail uri={comment.image} style={styles.commentImage} contentFit="contain" accessibilityLabel="Abrir imagen del comentario"/>}
          <Pressable onPress={() => startReply(comment)} style={styles.replyAction} accessibilityRole="button">
            <Text style={styles.replyActionText}>Responder</Text>
          </Pressable>
          {comment.authorId === userId && <Pressable onPress={() => confirmDelete(comment)} disabled={deleting === comment.id} style={styles.replyAction} accessibilityRole="button">
            <Text style={styles.deleteActionText}>{deleting === comment.id ? 'Borrando…' : 'Borrar'}</Text>
          </Pressable>}
        </View>
      </View>
      {renderReplies(comment.id, depth + 1)}
    </View>;
  }
  function renderReplies(parentCommentId: string | null, depth = 0): ReactElement[] {
    return comments.filter((comment) => comment.parentCommentId === parentCommentId).map((comment) => renderComment(comment, depth));
  }

  const postHeader = <>
    <View style={styles.post}>
      {repostContext && <RepostLabel repost={repostContext} />}
      <View style={styles.user}><Avatar uri={author.avatar}/><View><Text style={styles.name}>{author.name}</Text><Text style={styles.handle}>@{author.username} · {post.time}</Text></View></View>
      {activePost.text ? <Text style={styles.body}>{activePost.text}</Text> : null}
      {activePost.image && <ImageThumbnail uri={activePost.image} style={[styles.postImage, !activePost.text && styles.postImageWithoutText]} accessibilityLabel="Abrir imagen de la publicación"/>}
      <PostActions likes={activePost.likes} reposts={activePost.reposts} comments={activePost.commentsCount ?? activePost.comments.length} liked={activePost.liked} reposted={activePost.reposted} onLike={() => { void toggleLike(activePost.id, userId).catch((error: unknown) => Alert.alert('No se pudo actualizar Me gusta', error instanceof Error ? error.message : 'Inténtalo de nuevo.')); }} onRepost={() => { void toggleRepost(activePost.id, userId).catch((error: unknown) => Alert.alert('No se pudo actualizar el Revirg', error instanceof Error ? error.message : 'Inténtalo de nuevo.')); }} onComment={() => setReplyingTo(null)}/>
    </View>
    <View style={styles.section}><Text style={styles.sectionTitle}>Conversación</Text><Text style={styles.sectionCount}>{activePost.commentsCount ?? activePost.comments.length}</Text></View>
  </>;

  return <Screen>
    <Stack.Screen options={{ headerShown: true, title: 'Publicación', headerStyle: { backgroundColor: colors.background }, headerTintColor: colors.text, headerShadowVisible: false }}/>
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <FlatList
        data={comments.filter((comment) => comment.parentCommentId === null)}
        keyExtractor={(comment) => comment.id}
        renderItem={({ item }) => renderComment(item, 0)}
        ListHeaderComponent={postHeader}
        ListEmptyComponent={commentsLoading ? <Text style={styles.empty}>Cargando comentarios…</Text> : commentsError ? <Pressable onPress={() => void loadComments()}><Text style={styles.empty}>{commentsError} Toca para volver a intentar.</Text></Pressable> : <Text style={styles.empty}>Sé la primera persona en responder.</Text>}
        contentContainerStyle={styles.list}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      />
      <View style={styles.composer}>
        {replyingTo && <View style={styles.replyingBar}>
          <Text style={styles.replyingText}>Respondiendo a @{replyingTo.author?.username ?? 'usuario'}</Text>
          <Pressable onPress={cancelReply} accessibilityRole="button" accessibilityLabel="Cancelar respuesta"><Text style={styles.cancel}>Cancelar ×</Text></Pressable>
        </View>}
        <View style={styles.composerRow}>
          <Pressable onPress={() => void pickCommentImage()} disabled={sending || pickerBusy} accessibilityRole="button" accessibilityLabel="Agregar imagen" style={styles.attachButton}>
            {pickerBusy ? <ActivityIndicator size="small" color={colors.accent}/> : <SymbolView name={{ ios: 'photo', android: 'image', web: 'image' }} tintColor={colors.accent} size={23} weight="regular"/>}
          </Pressable>
          <Field value={text} onChangeText={setText} placeholder={replyingTo ? `Responde a @${replyingTo.author?.username ?? 'usuario'}…` : 'Escribe un comentario…'} style={styles.field}/>
          <Button title={sending ? 'Enviando…' : 'Enviar'} onPress={() => void submit()} disabled={(!text.trim() && !selectedImage) || sending || pickerBusy}/>
        </View>
        {selectedImage && <View style={styles.previewWrap}>
          <Image source={{ uri: selectedImage.uri }} style={styles.previewImage} contentFit="contain"/>
          <Pressable accessibilityRole="button" accessibilityLabel="Quitar imagen seleccionada" disabled={sending} onPress={() => setSelectedImage(null)} style={styles.removeImage}>
            <Text style={styles.removeImageText}>×</Text>
          </Pressable>
        </View>}
      </View>
    </KeyboardAvoidingView>
  </Screen>;
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  list: { paddingBottom: 20, flexGrow: 1 },
  post: { padding: 18, borderBottomWidth: 1, borderBottomColor: colors.border },
  user: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  name: { color: colors.text, fontWeight: '700', fontSize: 14 },
  handle: { color: colors.muted, fontSize: 12 },
  body: { color: colors.text, fontSize: 18, lineHeight: 27, marginTop: 18 },
  postImage: { width: '100%', height: 230, borderRadius: 16, marginTop: 14 },
  postImageWithoutText: { marginTop: 18 },
  section: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 18, paddingTop: 17, paddingBottom: 5 },
  sectionTitle: { color: colors.text, fontWeight: '700', fontSize: 15 },
  sectionCount: { color: colors.muted, fontSize: 12 },
  threadBranch: { borderLeftColor: colors.border, borderLeftWidth: 1, marginLeft: 10, paddingLeft: 8 },
  comment: { flexDirection: 'row', paddingHorizontal: 18, paddingVertical: 13, gap: 11, borderBottomWidth: 1, borderBottomColor: colors.border },
  nestedComment: { paddingHorizontal: 4 },
  commentMain: { flex: 1, paddingTop: 2 },
  commentIdentity: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 4 },
  commentText: { color: colors.text, fontSize: 14, lineHeight: 21, marginTop: 6 },
  commentImage: { width: '100%', height: 180, borderRadius: 14, marginTop: 10, backgroundColor: colors.surfaceRaised },
  replyAction: { alignSelf: 'flex-start', paddingVertical: 7, paddingRight: 12 },
  replyActionText: { color: colors.accent, fontSize: 12, fontWeight: '700' },
  deleteActionText: { color: colors.muted, fontSize: 12, fontWeight: '700' },
  empty: { color: colors.muted, paddingHorizontal: 20, paddingVertical: 18, fontSize: 13 },
  composer: { borderTopColor: colors.border, borderTopWidth: 1, backgroundColor: colors.background, paddingHorizontal: 12, paddingTop: 8, paddingBottom: 9 },
  replyingBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 6, paddingBottom: 7 },
  replyingText: { color: colors.muted, fontSize: 12 },
  cancel: { color: colors.accent, fontWeight: '700', fontSize: 12 },
  composerRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  attachButton: { width: 34, height: 42, alignItems: 'center', justifyContent: 'center' },
  field: { flex: 1, paddingVertical: 11 },
  previewWrap: { position: 'relative', alignSelf: 'flex-start', marginTop: 9, width: 104, height: 92, borderRadius: 12, overflow: 'hidden', backgroundColor: colors.surfaceRaised },
  previewImage: { width: '100%', height: '100%' },
  removeImage: { position: 'absolute', top: 5, right: 5, width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(11,13,16,0.82)' },
  removeImageText: { color: colors.text, fontSize: 20, lineHeight: 23 },
  missing: { color: colors.muted, padding: 24 },
});

