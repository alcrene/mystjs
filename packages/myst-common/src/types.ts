import type { Root } from 'mdast';
import type { FootnoteDefinition, Node } from 'myst-spec';
import type { VFile } from 'vfile';

export type GenericNode<T extends Record<string, any> = Record<string, any>> = {
  type: string;
  kind?: string;
  children?: GenericNode<Record<string, any>>[];
  value?: string;
  identifier?: string;
  label?: string;
  position?: Node['position'];
} & T;

export type GenericParent<T extends Record<string, any> = Record<string, any>> = GenericNode<T> & {
  children: GenericNode<T>[];
};

export type Citations = {
  order: string[];
  data: Record<string, { html: string; number: number; doi: string | undefined }>;
};

export type Footnotes = Record<string, FootnoteDefinition>;

export type References = {
  cite?: Citations;
  footnotes?: Footnotes;
  article?: Root;
};

// Types for defining roles and directives

export enum ParseTypesEnum {
  string = 'string',
  number = 'number',
  boolean = 'boolean',
  parsed = 'parsed',
}

export type ParseTypes = string | number | boolean | GenericNode[];

export type ArgDefinition = {
  type: ParseTypesEnum;
  required?: boolean;
  doc?: string;
};

type BodyDefinition = ArgDefinition;

type OptionDefinition = ArgDefinition;

export type DirectiveData = {
  name: string;
  arg?: ParseTypes;
  options?: Record<string, ParseTypes>;
  body?: ParseTypes;
};

export type RoleData = {
  name: string;
  body?: ParseTypes;
};

export type DirectiveSpec = {
  name: string;
  alias?: string | string[];
  doc?: string;
  arg?: ArgDefinition;
  options?: Record<string, OptionDefinition>;
  body?: BodyDefinition;
  validate?: (data: DirectiveData, vfile: VFile) => DirectiveData;
  run: (data: DirectiveData, vfile: VFile) => GenericNode[];
};

export type RoleSpec = {
  name: string;
  alias?: string | string[];
  body?: BodyDefinition;
  validate?: (data: RoleData, vfile: VFile) => RoleData;
  run: (data: RoleData, vfile: VFile) => GenericNode[];
};
