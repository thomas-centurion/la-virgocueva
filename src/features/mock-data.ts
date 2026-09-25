export type User = { id?: string; username: string; name: string; bio: string; avatar: string | null; cover: string | null };
export type Comment = {
  id: string;
  postId: string;
  authorId: string;
  text: string;
  image?: string;
  parentCommentId: string | null;
  createdAt: string;
  time: string;
  author?: User;
};
export type RepostContext = { user: User; createdAt: string; time: string };
export type Post = { id: string; userId?: string; username: string; author?: User; text: string; time: string; createdAt?: string; likes: number; reposts: number; comments: Comment[]; commentsCount?: number; image?: string; liked?: boolean; reposted?: boolean; repost?: RepostContext };

const photo = (id: string) => `https://images.unsplash.com/${id}?auto=format&fit=crop&w=800&q=80`;
const comment = (id: string, postId: string, authorId: string, text: string, time: string, parentCommentId: string | null = null, image?: string): Comment => ({
  id, postId, authorId, text, time, image, parentCommentId, createdAt: new Date().toISOString(),
});

export const users: User[] = [
  { username: 'sofi', name: 'Sofía Ríos', bio: 'Café, caminatas y cosas que quiero recordar. ☀️', avatar: photo('photo-1534528741775-53994a69daeb'), cover: photo('photo-1500530855697-b586d89ba3ee') },
  { username: 'juanperez', name: 'Juan Pérez', bio: 'Construyendo cosas y buscando el mejor café de la ciudad.', avatar: photo('photo-1500648767791-00dcc994a43e'), cover: photo('photo-1470252649378-9c29740c9fa8') },
  { username: 'martina', name: 'Martina López', bio: 'Un poco de todo, casi siempre con música.', avatar: photo('photo-1524504388940-b1c1722653e1'), cover: photo('photo-1470770841072-f978cf4d019e') },
  { username: 'pedro', name: 'Pedro Silva', bio: '¿Alguien para jugar esta noche?', avatar: photo('photo-1506794778202-cad84cf45f1d'), cover: photo('photo-1472214103451-9374bd1c798e') },
];
export const currentUsername = 'sofi';
export const findUser = (username: string) => users.find((user) => user.username.toLowerCase() === username.toLowerCase()) ?? users[1];
export const initialPosts: Post[] = [
  { id: '4', username: 'sofi', text: 'Qué lindo tener un lugarcito solo para nosotros 🌿', time: 'ahora', likes: 6, reposts: 1, comments: [comment('c5', '4', 'martina', 'Y que no se llene de publicidad ✨', 'hace un rato')] },
  { id: '3', username: 'juanperez', text: 'Qué buen día para salir a programar 🚀', time: '2 h', likes: 12, reposts: 3, comments: [
    comment('c1', '3', 'sofi', 'Planazo. ¿Dónde estás trabajando hoy?', '1 h'),
    comment('c2', '3', 'martina', 'Yo me sumo cuando termine esto ☕', '48 min'),
    comment('c6', '3', 'pedro', 'En ese café nuevo de la esquina.', '35 min', 'c1'),
    comment('c7', '3', 'sofi', 'Me lo anoto para la próxima 🙌', '20 min', 'c6'),
    comment('c8', '3', 'juanperez', '¡Dale, nos vemos ahí!', '10 min', 'c7'),
  ] },
  { id: '2', username: 'martina', text: 'Miren esto 😂', time: '4 h', likes: 25, reposts: 7, image: photo('photo-1517849845537-4d257902454a'), comments: [comment('c3', '2', 'pedro', 'JAJA no puede ser', '3 h', null, photo('photo-1533738363-b7f9aef128ce'))] },
  { id: '1', username: 'pedro', text: 'Alguien para jugar esta noche?', time: '6 h', likes: 8, reposts: 2, comments: [comment('c4', '1', 'sofi', 'Me prendo 🙋‍♀️', '5 h')] },
];
