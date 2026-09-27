import React from 'react';
import { useOwnerMediaUrl } from '../hooks/useOwnerMediaUrl';

type OwnerMediaImageProps = Omit<React.ImgHTMLAttributes<HTMLImageElement>, 'src'> & { source: string | null | undefined };

export const OwnerMediaImage: React.FC<OwnerMediaImageProps> = ({ source, ...props }) => {
  const url = useOwnerMediaUrl(source);
  return url ? <img {...props} src={url} /> : null;
};
